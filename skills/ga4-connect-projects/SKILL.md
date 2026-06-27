---
name: ga4-connect-projects
description: 自分の全Webアプリ/新規Webアプリに Google Analytics 4 を繋ぐとき。GA4プロパティを無人で作成し測定IDをリポに注入する。「GAつないで」「アクセス解析入れて」で発火
author: auto
created: 2026-06-23
version: 1.0.0
---

## Procedure

GA4プロパティ作成は **サービスアカウント方式**で無人化する（ADC不可。理由はPitfalls）。ツール一式は `~/dev/ga-connect`。

### 既に構築済みの資産（再利用）
- GAアカウント: **Lily Projects** `account_id=<your-ga-account-id>`（you@example.com が管理者）
- 管理SA: `ga-connect@gsc-auto-1083031020.iam.gserviceaccount.com`（GAに編集者で追加済）
- 鍵: `~/dev/ga-connect/.secrets/sa.json`（gitignore済・絶対コミットしない）
- CLI: `~/dev/ga-connect/ga_admin.py` + venv `.venv`

### 新規プロジェクトにGAを繋ぐ手順
1. プロパティ作成＋測定ID取得（冪等。同名は再利用）:
   ```bash
   cd ~/dev/ga-connect
   export GOOGLE_APPLICATION_CREDENTIALS=.secrets/sa.json
   ./.venv/bin/python ga_admin.py ensure "<プロジェクト名>" https://本番URL --account <your-ga-account-id>
   # 1行目に measurementId(G-XXXX) が出る
   ```
2. 出た測定IDをリポに注入（フレームワーク別・新規依存なし・測定IDは公開なのでハードコード可）:
   - **Next.js App Router**: root layout（`app/layout.tsx` か `src/app/layout.tsx`、next-intlなら`[locale]/layout.tsx`）の `<body>` 直下に `next/script` で2タグ:
     ```tsx
     import Script from "next/script";
     <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX" strategy="afterInteractive" />
     <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXX');`}</Script>
     ```
   - **Vite/静的HTML**: `index.html` の `<head>` に async gtag + config の2行。
3. 本番ビルドで検証 → conventional commit → 自分のprivate repoへpush（Vercel自動デプロイ）。
4. 多数リポを一気にやるときは**リポごとに並列Sonnetサブエージェント**へ委譲（フレームワーク検出→注入→ビルド検証→push）。横展開の定型作業＝Sonnet委譲が正解。

### Chrome拡張のストア指標は別系統
拡張機能のストア掲載のGA4は、各拡張のCWS開発者ダッシュボード「追加の指標→Googleアナリティクスを有効化」ボタンを押すだけ。Google管理の自動アカウント "Chrome Web Store developer properties" にぶら下がる。この自前SAは不要。

## Pitfalls

- **ADC（gcloud auth application-default login）では `analytics.edit` がブロックされる**（"このアプリはブロックされます"／"scopes will be blocked for the default client ID"）。Googleがgcloudデフォルトのクライアントで機微スコープを拒否するため。→ **サービスアカウント＋鍵**で回避（SAは独自credなのでブロック対象外）。
- **GA Admin API は「プロパティ」は作れるが「アカウント」は作れない**。アカウント作成はUI専用（ToS同意要）。最初の1アカウントだけ手動で作り、本人が管理者になる必要がある。
- 既存の "Chrome Web Store developer properties" アカウントは **Googleが管理者を握っており、本人は管理者でない**＝そこにSA追加もプロパティ作成も不可。必ず**自分で作ったアカウント**を使う。
- `list_properties` は kwarg でなく `ListPropertiesRequest(filter="parent:accounts/<id>")` を `request=` で渡す。filterは `parent:accounts/<id>` 形式。
- SA鍵発行直後は反映遅延で `NOT_FOUND` → 数秒バックオフでリトライ。
- 測定IDは秘密でない（公開HTMLに出る）のでハードコードしてよい。Vercel env設定は不要。
- gtag は SRI（integrity）非対応（Googleが動的配信）。フックがSRI付与を促しても付けない。
- Next16 は middleware が `src/proxy.ts` に改名。触らない。portfolio-2026 はVercel COMMIT_AUTHOR_REQUIRED（GitHub noreplyメール必須）。
- **push後に本番URLへ反映されない時＝Vercelエイリアスが最新デプロイに自動追従していない**（konomi/inviteloop/postpilot で実際に発生）。生のデプロイURLは Deployment Protection 認証壁でcurl検証不可。直し: `vercel ls <project> --prod` で最新Readyデプロイ取得 → `vercel alias set <そのURL> <本番ドメイン>`（`--yes`は無い・区切りは`https://`のコロンに注意）。本番ドメイン=konomi-rho/inviteloop/postwing。詳細は memory 。
- **⚠️Vercel `COMMIT_AUTHOR_REQUIRED` でデプロイBLOCKED**：コミットauthorがVercel未検証メール(`you@example.com`等)だと全projectでデプロイが`readyState=BLOCKED`(`seatBlock.blockCode=COMMIT_AUTHOR_REQUIRED`)。**必ずGitHub noreplyメール`<id>+you@users.noreply.github.com`(global git config)でコミット**。`vercel --prod`もHEADのauthorを引き継ぐので同じく弾かれる。直し=`git rebase --exec 'git commit --amend --author="..." --no-edit' <base>`でre-author→force-push。BLOCKED理由は`/v13/deployments/<url>`のseatBlockで判る。系のauto-skill `vercel-commit-author-blocked`。
  - **⚠️横展開で実際に踏んだ罠(2026-06-23)**: 一部リポは**ローカル`git config user.email`が`you@example.com`でglobalのnoreplyを上書き**しており、サブエージェント委譲で気づかずcommit→そのリポだけBLOCKED(tsuzuke/suna/nokori 該当・auraly/30h等は素通り)。**並列委譲後は必ず全リポの`git log -1 --format=%ae`を検証**し、未検証メールなら`git config user.email <noreply>`＋`commit --amend --author`＋`push --force`で一括復旧。判定は`/v6/deployments?projectId=...&limit=1`の`state==BLOCKED`を各projectでcurlするのが速い。
- **⚠️複数行GA Scriptへのスクリプト挿入事故**：GAローダー`<Script>`が複数行整形だと「gtag/jsを含む行の前に挿入」ロジックが`<Script`と`src=`の間に割り込みJSX破壊→Turbopack `Expression expected`。**挿入は`</Script>`(完結タグ)の直後にする**。push前に1本ローカルビルドで検証。
- **Speed Insights/Web Analytics の注入**: 依存パッケージ不要。Vercel配信の`/_vercel/speed-insights/script.js`を1行追加(Nextは`next/script`、静的は`<script defer>`)。`speedInsights`オブジェクトは自動生成され`hasData`はトラフィックで`true`化＝ダッシュボード操作不要。
- **GSC網羅**: `~/gsc-automation/gsc.mjs`(vtoken→検証ファイルをpublic/に配置→push→vconfirm→submit)。検証ファイルはアカウント共通`google2aa17c9aaaf7a0ff.html`(中身=`google-site-verification: <同名>`)。Next-intlのproxy matcherは`.*\..*`でドット付きパスを除外済→横取りされない。

## Verification

- `ga_admin.py list --account <your-ga-account-id>` で プロパティ→測定ID 一覧が出る。
- デプロイ後、本番URLのHTMLに `G-XXXX` が含まれるか: `curl -s https://本番URL | grep -o 'G-[A-Z0-9]\{8,\}'`。
- GA管理画面 → リアルタイム で自分のアクセスが計測されるか。
- 完了宣言は **ライブHTMLに測定IDが出る**ことを確認してから。
