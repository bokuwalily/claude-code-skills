---
name: nextauth-local-e2e-session
description: next-auth(v5/JWT)+Google OAuthのみのNext.jsアプリを、本番DBに触れずローカルdevでログイン済みE2E検証したいとき。セッションCookieを自作mintし、TURSO等のDB env をfile DBに差し替えて Playwright で通す手順。
author: auto
created: 2026-06-12
version: 1.0.0
---

## Procedure

1. **DB隔離**: Next.js はランタイム環境変数が `.env.local` より優先される。起動時に上書きして本番DBを遮断する:
   ```sh
   TURSO_DATABASE_URL="file:/tmp/<app>-e2e.db" TURSO_AUTH_TOKEN="" \
   AUTH_SECRET="<使い捨てdev文字列>" AUTH_TRUST_HOST=true \
   npx next dev -p 3105 > /tmp/dev.log 2>&1   # run_in_background
   ```
   注意: `TURSO_AUTH_TOKEN=""` は空文字（falsy判定でfile DBに落とすコードが多い）。URL側を空文字にすると `url ?? fallback` を素通りして壊れる。
2. **セッションCookie mint**: プロジェクト内に一時 .mjs を置き（bare import解決のため）、同じ AUTH_SECRET で:
   ```js
   import { encode } from "next-auth/jwt";
   const token = await encode({
     token: { email: "...", name: "E2E", sub: "e2e" },
     secret: process.env.AUTH_SECRET,
     salt: "authjs.session-token",   // v5: salt = cookie名 (httpsなら __Secure- 接頭辞)
     maxAge: 3600,
   });
   ```
   Cookie名は `authjs.session-token`（http/localhost）。signIn callbackはセッション読取時には走らないので、Googleプロバイダ無効でも auth() は通る。
3. **Playwright**: `context.addCookies([{ name: "authjs.session-token", value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }])` → 認証必須ページ・API が全部動く。
4. 検証後: 一時mintスクリプト削除、`pkill -f "next dev -p <port>"`、`/tmp` のDB破棄。

## Pitfalls

- **Next dev overlayの`[role=dialog]`**: dev modeはhiddenなエラーoverlay dialogをDOMに常駐させる。モーダルのdetach待ちは `[aria-label*='...']` などアプリ固有セレクタで行う。`[role=dialog]` は永久にdetachしない。
- **`page.once("dialog", ...)` の残骸**: 「念のためaccept」を仕掛けて発火しないと、後続テストのconfirmを横取りする。confirm検証前に `page.removeAllListeners("dialog")`。
- playwright未インストールのプロジェクトでは `/tmp` に `npm i playwright` した使い捨てprojectから実行（対象repoのpackage.jsonを汚さない）。ブラウザバイナリは `~/Library/Caches/ms-playwright` に共有キャッシュ済みのことが多い。
- 検証アサートの月表示等は実レンダリング文字列（例: "2026年 6月" のスペース）に合わせる。

## Verification

- `curl -H "Cookie: authjs.session-token=$TOKEN" http://localhost:<port>/api/<protected>` が200で実データを返す
- `/tmp/<app>-e2e.db` が生成・成長している（=本番DB非接続の証拠）
- 書き込み系フロー（保存→一覧反映）をPlaywrightで通し、スクショを /tmp に保存
