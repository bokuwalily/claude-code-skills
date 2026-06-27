---
name: human-review-gate-shell
description: バッチ生成したファイル（記事・コード・レポートなど）をシェルで対話的に1件ずつレビューし、approve/skip/reject/editで振り分けるゲートスクリプトを作るとき。
author: auto
created: 2026-06-20
version: 1.0.0
status: active
---

## Procedure

### 1. ディレクトリ構成

```
project/
├── drafts/     # 未レビューのファイル置き場
├── approved/   # 承認済み（次処理へ）
├── rejected/   # 却下済み
└── review-gate.sh
```

### 2. スクリプト全体

```bash
#!/bin/bash
# 対話型レビューゲート
# a=承認  s=保留  d=却下  e=編集  q=終了
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR/approved" "$DIR/rejected"

shopt -s nullglob
drafts=("$DIR"/drafts/*.md)   # 対象の拡張子を変えて流用可
if [ ${#drafts[@]} -eq 0 ]; then
  echo "drafts/ は空。先に生成スクリプトを実行してください。"
  exit 0
fi

echo "未チェック: ${#drafts[@]} 件"
echo "操作: [a]承認 [s]保留 [d]却下 [e]編集 [q]終了"
echo "────────────────────────────────────────────"

for f in "${drafts[@]}"; do
  while true; do
    clear 2>/dev/null || true
    echo "📄 $(basename "$f")"
    # メタ行（HTMLコメントなど）を先頭1行だけ表示
    head -1 "$f" | sed 's/<!-- *//; s/ *-->//'
    echo "────────────────────────────────────────────"
    # 本文プレビュー（メタ行除く先頭60行）
    tail -n +2 "$f" | sed '/./,$!d' | head -60
    echo "────────────────────────────────────────────"
    printf "[a]承認 [s]保留 [d]却下 [e]編集 [q]終了 > "
    read -r ans </dev/tty
    case "$ans" in
      a|A) mv "$f" "$DIR/approved/"; echo "✅ 承認"; sleep 0.4; break ;;
      d|D) mv "$f" "$DIR/rejected/"; echo "🗑  却下"; sleep 0.4; break ;;
      s|S) echo "⏭  保留"; sleep 0.3; break ;;
      e|E) "${EDITOR:-vi}" "$f" </dev/tty >/dev/tty 2>&1 ;;
      q|Q) echo "終了"; exit 0 ;;
      *)   echo "a/s/d/e/q のどれかを入力"; sleep 0.6 ;;
    esac
  done
done

echo "────────────────────────────────────────────"
echo "承認済み: $(ls "$DIR"/approved/*.md 2>/dev/null | wc -l | tr -d ' ') 件"
```

### 3. 呼び出し方

```bash
# 通常実行（drafts/ のファイルを順に表示）
bash review-gate.sh

# 承認済みを後処理（例: 投稿キューへコピー）
for f in approved/*.md; do
  # 投稿処理...
  rm "$f"   # 処理済みは削除してキューを空にする
done
```

### 4. 拡張パターン

**メタ情報をファイル先頭に埋め込む（生成スクリプト側）**

```bash
{
  printf '<!-- TYPE: %s | SCORE: %s | gen: %s -->\n\n' "$TYPE" "$AVG" "$(date +%F_%T)"
  printf '%s\n' "$BODY"
} > "drafts/${TS}.md"
```

こうすると review-gate.sh の `head -1 | sed` でメタを1行表示できる。

**バッチ承認（全件承認）**

```bash
mv drafts/*.md approved/
```

**承認件数のしきい値チェック**

```bash
count=$(ls approved/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -ge 5 ]; then
  echo "承認済みが $count 件溜まっています。投稿処理を実行してください。"
fi
```

## Pitfalls

- **`read -r ans </dev/tty`**: パイプ経由で実行すると stdin がパイプになり `read` が失敗する。必ず `/dev/tty` から読む
- **`shopt -s nullglob`**: glob が空にマッチしたとき配列が空になる。これがないと `drafts/*.md` が文字列として残り誤動作する
- **`clear 2>/dev/null || true`**: TTY でない環境（CI）では clear が失敗することがある。`|| true` で握りつぶす
- **編集後の再判断**: `e|E` でエディタを開いたあとループを `break` しないことで、編集後に再度 a/s/d を聞ける設計になっている
- **approved/ の肥大化**: 処理済みファイルをそのまま残すと次回 glob に引っかかる場合がある。後処理で削除またはアーカイブする

## Verification

```bash
# テスト用ダミーファイルを作成
mkdir -p drafts
echo "<!-- TYPE: テスト | SCORE: 8.0 | gen: 2026-06-20 -->

# テスト記事
本文サンプル。
" > drafts/2026-06-20_test.md

# ゲートを起動して a を入力 → approved/ に移動することを確認
bash review-gate.sh

ls approved/   # ファイルが存在すること
ls drafts/     # 空であること
```
