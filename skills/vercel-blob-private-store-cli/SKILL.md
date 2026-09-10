---
name: vercel-blob-private-store-cli
description: Vercel Blob の private ストアをCLI/APIだけで作り、プロジェクトへ接続して環境変数を自動投入するまでの手順。GUI不要。デプロイが「Vulnerable version of Next.js detected」で落ちる罠も含む。
author: auto
created: 2026-09-04
version: 1.0.0
---
## Procedure
1. `vercel link --yes --project <name>`（未作成なら同時に作られる）
2. `vercel blob create-store <name> --access private`（`--access` 必須。末尾の「link しますか？」プロンプトは stdin 無しだと落ちるので無視してよい）
3. 接続はAPIで: token は `~/Library/Application Support/com.vercel.cli/auth.json` の `token`。
   `curl -X POST "https://api.vercel.com/v1/storage/stores/<store_id>/connections?teamId=<team>" -H "Authorization: Bearer $TOK" -d '{"projectId":"<prj>","envVarEnvironments":["production","preview","development"]}'`
   → `vercel env ls` に BLOB_READ_WRITE_TOKEN が出る。
4. 他の秘密値は `printf '%s' "$VAL" | vercel env add NAME production`。
5. コードは `put(key, body, {access:'private'})`、読みは `get(url,{access:'private'})`（素の fetch は401）。
## Pitfalls
- **next 15.5.0 は Vercel がデプロイ拒否**（ビルド成功後 "Vulnerable version of Next.js detected" で status error、`vercel logs` は読めない）。`npm i next@15` でパッチ版へ。ビルドログは `GET /v3/deployments/<dpl>/events` で取れる。
- ローカルfallback（.data/）を持つ store 実装は本番Blob経路のバグを隠す。**本番入口からE2E（フォーム送信→admin表示）** を必ず1回走らせ、テストレコードは `vercel blob del <path> --rw-token $RW`（RWは `vercel env pull` で取得）で消す。
- Blob の pathname に日本語は使わず sha256 先頭16でキー化。
## Verification
`vercel env ls` に BLOB_READ_WRITE_TOKEN / `vercel blob list --rw-token $RW` にレコードが出る。
