---
name: webapp-legal-contact-pages
description: 新規webapp/Webゲームに LP・お問い合わせ・プライバシーポリシー・利用規約 を実態に合わせて追加する時。特にログイン/個人情報を扱うアプリ。ログイン不要でも問い合わせ導線は必須。
author: auto
created: 2026-06-10
version: 1.0.0
---

## Procedure

1. **実態調査（コピペ防止の起点）**
   - ルート構成: `find src/app -name page.tsx`。トップがLPかログイン即か。既存の privacy/terms/contact 有無。
   - 認証: middleware/proxy か、クライアント `AuthRequired` 方式か。`NEXT_PUBLIC_AUTH_MODE` 等。
   - 取得データ: prisma schema の User / DB のテーブル / OAuth scope（Gmail/Calendar/AI送信の有無）。→ **これがプラポリの中身**。
   - デザイントークン: `globals.css` の `:root` か Tailwind v4 `@theme`。LP/法務はこのトークンに合わせる。
2. **LP**: 未ログインの入口を作る。ヒーロー＋実機能（コードから抽出）＋使い方＋CTA。
   - middlewareガード型 → ダッシュボードを `/dashboard` に退避し `/` をLPに。ログイン済は `/`→`/dashboard` リダイレクトで保険。`/`参照（href/redirect/callbackUrl）を grep で全張り替え。
   - クライアント認証型 → 未ログイン時に出る共通コンポーネント（`AuthRequired`等）自体をLP化すれば全経路でLPが出る（ルート変更不要＝低リスク）。
3. **法務ページ**: `/privacy` `/terms` を新設。取得データ・第三者送信先（Google/Vercel/Turso/Anthropic等）を**実態どおり**列挙。決済が無ければ特商法は不要。大学/第三者の非公式ツールなら「公式で確認」免責を入れる。
4. **問い合わせ**: `/contact` フォーム + `POST /api/feedback` → 既存DB(Turso)に Feedback テーブル保存。外部サービスは足さない。匿名可・任意メール。
5. **到達性**: middlewareがあれば公開パスに `/`(完全一致) `/privacy` `/terms` `/contact` `/api/feedback` を追加。**設定ページとフッターに法務・問い合わせリンク**を置きログイン後からも到達可能に。
6. **ゲーム/ログイン無しアプリ**: 最低限「開発者へのお問い合わせ」をホームかポーズ/設定に出す。
7. ビルド → commit → push → `vercel --prod --yes` → ライブ疎通。

## Pitfalls

- **プラポリのテンプレ流用は危険**。決済しないのに特商法、AI使わないのにAI送信、などズレると逆効果。必ずコードで実態確認。
- **Tursoへのスキーマ反映手段はプロジェクト差**: `prisma.config.ts` が `file:./dev.db` 固定だと `prisma db push` はローカルのみ。本番は `@libsql/client` 直CREATE か、起動時 `ensureInit` に `CREATE TABLE IF NOT EXISTS` を足す（後者が手動マイグレ不要で楽）。
- **proxyの公開パス**: `startsWith` に `/` を足すと全パス公開になる。ルートは `pathname === "/"` の完全一致で別扱い。
- **ルート移動時の張り替え漏れ**: ログイン済が `/` に来たら `/dashboard` へリダイレクトする保険を入れると、参照漏れがあっても事故らない。
- **pre-pushレイアウトゲート（hosei等）**: `grid`+レスポンシブ列で base `grid-cols-*` 無しは弾かれる。base に `grid-cols-1` を足す（CSS Grid暗黙auto列の横溢れ対策）。
- **dotenv未導入のプロジェクト**: `-r dotenv/config` が preload失敗。`export $(grep '^TURSO_' .env.local | xargs)` で env注入してから tsx 実行。接続変数名はプロジェクト差（`DATABASE_URL` vs `TURSO_DATABASE_URL`）。
- `vercel project remove` に `yes` をパイプすると (y/N) を無限ループさせ巨大出力になる。`--non-interactive` を使う。

## Verification

- 全公開ページが本番で 200。LP本文の想定テキストが出る（クライアント描画LPは curl に出ないのでブラウザ/スクショで確認）。
- 本番で `POST /api/feedback` → `{"success":true}` を確認し、**`__CLAUDE_VERIFY__` 検証行を即削除**（ダミー残存ゼロ）。
- ログイン後の設定ページ・フッターから問い合わせ/法務に到達できる。
- `/dashboard` 等の保護ページは未ログインで signin にリダイレクトされる（認証ガード健在）。
