---
name: cloudflare-workers-do-deploy
description: Cloudflare Workers + Durable Objects + D1 + 静的アセット(SPA)を無料で本番デプロイする時。wrangler login後の手順とハマりどころ(サブドメイン変更・証明書待ち・secret衝突・無料DO)に使う
author: auto
created: 2026-06-26
version: 1.0.0
---

## Procedure

Cloudflare全部入り(Workers + Durable Objects + D1 + SPAアセット)の本番化手順。実例=中の人AI(`~/dev/nakanohito-ai`)。

1. **無料DO設定**: `wrangler.toml` の `` に `new_sqlite_classes = ["ClassA",...]` を指定（SQLite backendのDOは**無料プランで$0**。`new_classes`だとWorkers Paid要求になり得る）。`[assets] directory/binding/not_found_handling="single-page-application"` でSPA同居。
2. **ログイン**(対話/本人): `! npx wrangler login`（ブラウザOAuth。Claudeから不可）。
3. **D1作成→id差替**: `npx wrangler d1 create <db>` → 出力 `database_id` を `wrangler.toml` の `` に貼る。
4. **本番マイグレ**: `npx wrangler d1 migrations apply <db> --remote`（非対話でも fallback yes で進む）。
5. **初回デプロイの前提**: アカウントに**workers.devサブドメイン未作成**だと `ERROR 10063` で落ちる→ダッシュボードの Workers & Pages を一度開くと自動作成。
6. **デプロイ**: `npm run deploy`（= フロントbuild && `wrangler deploy`）。URL=`<worker名>.<アカウントサブドメイン>.workers.dev`。
7. **secret投入**: `printf '%s' "$VALUE" | npx wrangler secret put NAME`（値は画面に出さない）。
8. **検証**: `curl https://.../api/health` → 本番E2E（`test/e2e.mjs`をHTTPS/WSSに差し替えて実行）→ テストデータを `wrangler d1 execute <db> --remote --command "DELETE FROM ..."` で一掃。

## Pitfalls

- **サブドメインに個人情報が乗る**: アカウントサブドメインは初期値がメール由来(例 `you-phone`)。公開URLに旧ハンドルが出る→**ダッシュボード「Change account subdomain」でブランド名に変更**。⚠️**APIの PUT `/accounts/{id}/workers/subdomain` は既存だと `10036` で変更不可＝GUI必須**。⚠️**アカウント単位**＝全Workerが `*.<新サブドメイン>.workers.dev` になるのでアプリ名でなくブランド名(例 `bokuwalily`)にする。
- **新サブドメインのTLS証明書発行に10〜15分**。`dig` は引けるのに `curl` が `sslv3 alert handshake failure / http_code=000` になる＝証明書待ち。**deploy自体は証明書と無関係に成功する**ので、待つ間に sitemap/GA4/secret 等を進める。証明書発行直後の**初回WS接続もコールドスタートで数分遅い**(E2Eが2分超過しても少し後に再実行で通る)。
- **var と secret の名前衝突**: `wrangler.toml [vars] NAME=""` を残したまま `secret put NAME` すると `10053 Binding name already in use`。→ tomlから該当varを**消して再デプロイ**してから secret put。
- **`wrangler subdomain` コマンドは非推奨**(deprecated)。サブドメイン操作はGUIへ。
- **委譲の空振り**: フロント等を `codex exec` に投げると banner出力のみ・exit0でもファイル0のことがある→`git status`/`find`で実体確認、空ならSonnetサブエージェントへフォールバック。

## Verification

- `curl -s https://<url>/api/health` → `{"ok":true}`
- 本番E2Eスクリプト全PASS（WS往復＋永続状態）
- `wrangler d1 execute <db> --remote --json --command "SELECT count(*) ..."` で本番テストデータが0
- secret: `wrangler secret list` に登録名が出る／webhook等はリポにcommitされていない(`grep -r 'webhooks' src web`が空)
