---
name: vercel-ssr-5xx-cold-render-diagnosis
description: Vercel/Next.jsで「curlは200なのにGoogle Search Consoleのライブテスト/インデックス登録が5xxで弾かれる」時。aliasのキャッシュが症状を隠す問題、コールド初回レンダリングだけ落ちる断続5xx、jsdom依存ライブラリ(isomorphic-dompurify等)のERR_REQUIRE_ESMランタイムクラッシュの診断と修正。
author: auto
created: 2026-06-10
version: 1.0.0
---

# Vercel SSR コールド5xx（curlは通るのにGSC/Googlebotが5xx）

## Procedure

症状：GSCのURL検査ライブテストやサイトマップが「サーバーエラー(5xx)」「取得できませんでした」。
だが手元の `curl https://<alias>.vercel.app/path` は 200 を返す。

1. **aliasキャッシュに騙されるな**。aliasのURLは前回ビルドのISR/SSGキャッシュ済みHTMLを配信するため200に見える。
   実レンダリングを叩くには **生のデプロイURL** を使う：
   ```bash
   npx vercel ls   # 生URL shukatsu-xxx-<hash>-<team>.vercel.app を取得
   # まだ一度もアクセスされてない動的パス(高ID等)をコールドで叩く
   GB="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
   for id in 300 333 360 390; do
     curl -s -o /dev/null -w "%{http_code} /path/$id\n" -A "$GB" "https://<生URL>/path/$id"
   done
   ```
   コールド初回=500、リトライ=200 なら「オンデマンドISRレンダリングのクラッシュ」確定。

2. **真因はランタイムログで取る**（ブラウザのエラーHTMLでは分からない）：
   ```bash
   ( timeout 25 npx vercel logs "https://<生URL>" & sleep 4; \
     curl -s -o /dev/null -A "$GB" "https://<生URL>/path/811"; wait ) \
     | grep -iE "error|exception|ERR_|require|esm|module"
   ```

3. **典型的真因＝jsdom依存ライブラリのESMクラッシュ**：
   ```
   Failed to load external module jsdom: ERR_REQUIRE_ESM:
   require() of ES Module .../@exodus/bytes/encoding-lite.js
   from html-encoding-sniffer ... not supported.
   ```
   犯人候補：`isomorphic-dompurify`（サーバーでjsdomをrequire）。SSRページのサニタイズ用途で混入しがち。

4. **修正**：jsdom依存を外し、**純JS(htmlparser2ベース)の `sanitize-html`** に置換する。
   ⚠️ 正規表現でのHTMLサニタイズは回避可能でNG（自動セキュリティレビューでHIGH/MEDIUM XSSとして弾かれる）。
   第一者コンテンツでも allowlist 方式の本物のサニタイザを使うこと。
   ```bash
   npm install sanitize-html @types/sanitize-html
   ```
   ```ts
   import sanitizeHtml from 'sanitize-html'
   const raw = marked.parse(content) as string
   return sanitizeHtml(raw, {
     allowedTags: ['h1','h2','h3','h4','h5','h6','p','a','ul','ol','li','blockquote',
       'strong','em','b','i','del','s','mark','sup','sub','code','pre','hr','br','span',
       'table','thead','tbody','tr','th','td','img'],
     allowedAttributes: { a:['href','name','target','rel','title'],
       img:['src','alt','title','width','height','loading'], h2:['id'], h3:['id'],
       th:['align'], td:['align'], span:['class'], code:['class'] },
     allowedSchemes: ['http','https','mailto'],
     allowedSchemesAppliedToAttributes: ['href','src'],
     transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) },
   })
   ```
   sanitize-html は jsdom を使わないので Vercel ランタイムで ERR_REQUIRE_ESM を起こさない（デプロイ後コールドで再検証必須）。
   ユーザー入力(コメント等)は別問題。Reactの `{value}` は自動エスケープなので `dangerouslySetInnerHTML` を使ってなければ無対応でOK。

5. デプロイ後、手順1のコールドテストで全200を確認してから完了宣言。

## Pitfalls
- aliasのcurlが200でも「直った」と判断しない。必ず生URL＋未踏パスでコールド検証。
- 同一構成の他プロジェクト(同アカウント・同SSR+同ライブラリ)も同じ病巣を持つ。横展開で確認。
- 存在しないID/slugの404は正常（500と混同しない）。
- `marked.parse()` は型が `string | Promise<string>`。`as string` で受けてる既存コードに合わせる。
- package.jsonからのdep削除はlockfile変動リスク。import除去だけでバンドルからは除外される（最小修正）。

## Verification
```bash
GB="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
for id in 300 333 360 390 410 440; do
  curl -s -o /dev/null -w "%{http_code} /articles/$id\n" -A "$GB" "https://<新生URL>/articles/$id"
done   # 全部200ならOK（存在しないIDの404は許容）
```
その後GSCで URL検査→インデックス登録をリクエスト が通ることを確認。
