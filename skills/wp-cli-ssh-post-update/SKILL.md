---
name: wp-cli-ssh-post-update
description: SSH経由でWP-CLIを使いWordPress記事のHTMLをローカルファイルから一括アップロード（post update）するときに使う
author: auto
created: 2026-05-28
version: 1.1.0
status: active
disallowed-tools: Agent
disable-model-invocation: true
---

## Procedure

1. **SSHキーの準備**

```bash
# キーファイルをプロジェクトフォルダにコピーして権限を設定
cp ~/Downloads/server.key /path/to/project/server.key
chmod 600 /path/to/project/server.key
# 600でないとSSHが鍵を読み込まずに弾く
```

2. **接続テスト**

```bash
ssh -p PORT -i /path/to/project/server.key USER@HOST \
  "wp --path=/var/www/html/wp post list --posts_per_page=1 --skip-themes --skip-plugins"
# 記事一覧が返れば接続・WP-CLI実行ともにOK
```

3. **ローカルHTMLを記事に書き込む（1件）**

```bash
# post IDにローカルのHTMLファイルをstdinで流し込む
ssh -p PORT -i server.key USER@HOST \
  "wp --path=/var/www/html/wp post update POST_ID --post_content=- --skip-themes --skip-plugins" \
  < contents/post_POST_ID.html
```

4. **複数記事を一括処理**

```bash
#!/bin/bash
# batch_update.sh
SSH="ssh -p PORT -i server.key USER@HOST"
WP_PATH="/var/www/html/wp"

for id in 12345 23456 34567; do
  echo "Updating post $id..."
  $SSH "wp --path=$WP_PATH post update $id --post_content=- --skip-themes --skip-plugins" \
    < contents/post_${id}.html
  sleep 1  # サーバー負荷を抑えるために少し待つ
done
```

5. **URL→ID変換（事前準備）**

```bash
# URLからpost IDを取得するWP-CLIコマンド
ssh -p PORT -i server.key USER@HOST \
  "wp --path=/var/www/html/wp post list --post_type=post --fields=ID,guid \
   --posts_per_page=-1 --format=csv --skip-themes --skip-plugins" \
  > url_id_map.csv
```

## Pitfalls

- **`--post_content=-`** は「stdinから受け取る」指定。`-` を忘れると空白上書きになる
- **`--skip-themes --skip-plugins`** を付けないと重いプラグインが全部ロードされてタイムアウトしやすい
- **改行コード**: Macで作ったHTMLをLinuxサーバーに送るとき `\r\n` が混入していると表示崩れの原因になる。`sed -i 's/\r//' file.html` で事前にLF統一を
- **バックアップ**: 一括更新前に `wp post get POST_ID --field=post_content > backup_POST_ID.html` で元の内容を保存しておく
- **ポート番号**: 標準の22番でないサーバーは `-p PORT` を必ず指定。デフォルト22なら省略可

## Verification

```bash
# 更新後にpost_contentを取得して確認
ssh -p PORT -i server.key USER@HOST \
  "wp --path=/var/www/html/wp post get POST_ID --field=post_content --skip-themes --skip-plugins" \
  | head -50
# 期待するHTMLが先頭に含まれていればOK
```
