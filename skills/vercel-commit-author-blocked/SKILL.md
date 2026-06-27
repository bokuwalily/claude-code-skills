---
name: vercel-commit-author-blocked
description: Vercelのデプロイが完了せず status UNKNOWN のまま固まり、本番に反映されない時の診断と解除。特に git author を変えた直後（匿名化・別ハンドル化）に発生する COMMIT_AUTHOR_REQUIRED ブロックの対処。
author: auto
created: 2026-06-11
version: 1.0.0
---

## Procedure

1. `vercel ls <project>` で Status が `UNKNOWN`・Duration `?` のまま数分以上動かないことを確認（正常な静的サイトは数秒でReady）。
2. CLIでは原因が見えないので REST API で生の状態を取る：
   ```bash
   TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json','utf8')).token)")
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://api.vercel.com/v13/deployments/<dpl_ID or URL>?teamId=<team_xxx>" \
     | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('readyState'),d.get('readyStateReason'),d.get('seatBlock'))"
   ```
3. `readyState: BLOCKED` + `seatBlock.blockCode: COMMIT_AUTHOR_REQUIRED` なら、コミットauthorのメールがGitHubアカウントに未登録（Hobbyプランはcommit authorがVercelユーザーに紐づく必要あり）。
4. 解除（実メールを公開せず匿名ハンドルを保つ場合）：GitHub noreplyメールに切り替える。
   ```bash
   GHID=$(gh api user --jq '.id'); GHLOGIN=$(gh api user --jq '.login')
   git config user.email "${GHID}+${GHLOGIN}@users.noreply.github.com"
   git commit --allow-empty -m "chore: redeploy with associated author" && git push
   ```
   force push は不要。新コミットが正規authorなら新デプロイは通る。
5. 新デプロイ Ready 後、本番ドメインへ curl で疎通・内容spot check（grep で新規文字列）まで確認して完了。

## Pitfalls

- `vercel ls` の `UNKNOWN` は CLI が `BLOCKED` を解釈できないだけ。`vercel inspect --logs` もログ空・Builds 0ms で無情報。
- デプロイURLを直接curlすると `instant-preview-site` のプレースホルダHTMLが200で返る＝「200だが中身が違う」罠。必ず内容をgrepする。
- git連携デプロイだけでなく **CLIの `vercel deploy` もブロックされる**（ローカルgitのHEAD authorがメタデータとして送られるため）。authorを直すまで何度デプロイしても無駄。
- 旧BLOCKEDデプロイは放置で無害（公開されない）。

## Verification

- `vercel ls <project>` 最新行が `● Ready`。
- 本番URLで新規追加ファイル（例 /privacy.html）が200、HTMLに新規文字列が含まれる。
