---
name: vercel-prod-ship
description: Vercel に本番デプロイし、production URL に alias を貼って疎通確認するまでの一気通貫パターン。発火: `vercel --prod` 入力時、本番リリース時、deploy command 失敗復旧時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Edit
---

# vercel-prod-ship

`vercel --prod` で生成される preview 用 deployment URL を、production ドメインに alias して 200 OK 疎通まで確認する 2 段デプロイ手順。

## Procedure

1. **pre-flight**: ローカルビルド成功を確認

   ```bash
   npm run build
   ```

   失敗したら deploy せず修正。

2. **deploy**: ログを残しつつ `vercel --prod` を実行

   ```bash
   vercel --prod 2>&1 | tee /tmp/vercel-deploy.log
   ```

3. **deployment URL 抽出**: ログから `*.vercel.app` を取り出す

   ```bash
   DEPLOY_URL=$(grep -oE 'https://[^ ]+\.vercel\.app' /tmp/vercel-deploy.log | head -1)
   echo "$DEPLOY_URL"
   ```

4. **alias 貼り**: production ドメインに紐付け

   ```bash
   vercel alias "$DEPLOY_URL" <production-domain>
   ```

5. **疎通確認**: production ドメインに HEAD リクエスト

   ```bash
   curl -sI https://<production-domain> | head -1
   ```

   `HTTP/2 200` を確認。

6. **失敗時のログ確認**: 404/500 が出た場合

   ```bash
   vercel logs https://<production-domain> --since=5m
   ```

## Pitfalls

- `vercel --prod` だけだと preview 用の `*.vercel.app` URL のままで、本番ドメインには反映されない。alias 必須。
- alias 先の domain は事前に `vercel domains add <domain>` 済みであること。未登録だと alias が失敗する。
- `next.config.js` の env 変数が prod / preview で別値になっているケースあり。値ズレで 500 になることがある。
- アカウント / team 切り替え忘れ:

  ```bash
  vercel whoami
  vercel switch <team>
  ```

- build 成果物が `.next` 以外（`out/` 等 static export）の場合は `vercel.json` の `outputDirectory` を確認。
- 既存 `/deploy` や `ship-safe` は汎用フロー。このスキルは vercel CLI 限定の 2 段（deploy → alias）パターン。

## Verification

- deployment URL: `https://<project>-<hash>.vercel.app` 形式が抽出できている
- production domain: `curl -sI` で `HTTP/2 200`（または期待のステータス）
- alias 反映確認:

  ```bash
  vercel ls --prod | head -3
  ```

  最新の deployment が production ドメインに紐付いていること。

- 念のためブラウザ実 URL でも確認（キャッシュ・edge 反映遅延の可能性）。
