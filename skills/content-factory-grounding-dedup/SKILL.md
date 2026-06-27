---
name: content-factory-grounding-dedup
description: LLMコンテンツ生成スクリプトで「個人活動ログによるグラウンディング」と「投稿型/テーマの重複回避ログ」を組み合わせるパターン。generate.sh のような1本起草スクリプトを書くときに使う。
author: auto
created: 2026-06-21
version: 1.0.0
status: active
---

## Procedure

### 1. knowledge/ ディレクトリからプロンプトバンドルを組む

```bash
KNOW=""
for f in persona hooks style post-types quality-rubric; do
  KNOW+=$'\n\n===== '"$f"$' =====\n'"$(cat "$DIR/knowledge/$f.md")"
done
```

各テーマの markdown ファイルを1変数に結合して後続の PROMPT に埋め込む。
ファイル追加だけでナレッジを拡張できる。

### 2. 個人活動ログでグラウンディング（一次情報の注入）

```bash
GROUND=""
for src in "$HOME/.remember/recent.md" "$HOME/.remember/now.md" \
           "$HOME/Documents/claude-obsidian/wiki/hot.md"; do
  [ -f "$src" ] && GROUND+=$'\n\n--- '"$(basename "$src")"$' ---\n'"$(head -c 4000 "$src")"
done
[ -z "$GROUND" ] && GROUND="（作業ログ無し。一般的な知見で書く）"
```

- `head -c 4000` でトークン肥大を防ぐ
- ファイルが存在しなければフォールバックメッセージを使い、スクリプトを止めない
- プロンプトには「このログから固有名・数字・失敗を必ず拾え」と明示する

### 3. 直近 N 件の型/テーマを注入して重複を回避

```bash
TYPES_LOG="$DIR/logs/posted-types.log"
TOPICS_LOG="$DIR/logs/posted-topics.log"
touch "$TYPES_LOG" "$TOPICS_LOG"

LAST_TYPES=$(tail -3 "$TYPES_LOG" | paste -sd '、' -)
[ -z "$LAST_TYPES" ] && LAST_TYPES="（まだ無し）"
LAST_TOPICS=$(tail -8 "$TOPICS_LOG" | paste -sd '、' -)
[ -z "$LAST_TOPICS" ] && LAST_TOPICS="（まだ無し）"
```

プロンプトに「直近で使った型（これらは避ける）」「直近で扱ったテーマ（焼き直し禁止）」として挿入する。

### 4. 生成成功後にログへ追記

```bash
echo "$TYPE"  >> "$TYPES_LOG"
echo "$TOPIC" >> "$TOPICS_LOG"
echo "$(date '+%F %T')\tOK\tavg=$AVG\t$TYPE\t$TOPIC\t$FNAME" >> "$DIR/logs/gen.log"
```

追記専用（上書きしない）にすることで tail -N が常に正しい直近 N 件を返す。

### 5. ディレクトリ構成

```
<factory-dir>/
├── daily.sh          # launchd ラッパー（N本まとめ起草）
├── generate.sh       # 1本起草（本体）
├── review-gate.sh    # 人間チェックゲート（別スキル human-review-gate-shell）
├── PAUSED            # このファイルが存在したら全スクリプトが早期 exit 0
├── knowledge/
│   ├── persona.md
│   ├── hooks.md
│   ├── style.md
│   ├── post-types.md
│   └── quality-rubric.md
├── drafts/           # 未レビュー下書き
├── approved/         # 承認済み（投稿待ち）
├── rejected/         # 却下
└── logs/
    ├── gen.log       # タイムスタンプ付き全記録
    ├── posted-types.log
    └── posted-topics.log
```

## Pitfalls

- **ログが存在しない初回** は `touch` を忘れると `tail` がエラーで止まる。必ず `touch "$TYPES_LOG" "$TOPICS_LOG"` を先に実行する。
- **グラウンディングの文字数制限** を入れないと長い hot.md がトークンを食い尽くす。`head -c 4000` 程度の上限を各ファイルに付ける。
- **PAUSED ファイルのチェック** は generate.sh の先頭と daily.sh の先頭の両方に入れる。どちらか片方だけでは一括バッチが止まらない。
- `paste -sd '、' -` はファイルが空のとき空文字を返す。空ガードを必ず `[ -z "$LAST_TYPES" ] && LAST_TYPES="（まだ無し）"` で追加する。
- posted-types.log / posted-topics.log に書くのは **成功確定後だけ**。品質ゲート棄却時に書くと正常な型が「使用済み」扱いになってローテーションが壊れる。

## Verification

```bash
# 1. ログが正しく追記されているか
tail -5 logs/posted-types.log
tail -5 logs/posted-topics.log
tail -3 logs/gen.log

# 2. PAUSED 制御が効くか
touch PAUSED && bash generate.sh   # "[gen] PAUSED" が出ること
rm PAUSED

# 3. grounding が空でもスクリプトが止まらないか
X_ARTICLE_TEST_RESPONSE="TYPE: test\nTOPIC: テスト\nSCORE: {\"avg\":8.0}\n# タイトル\n本文" \
  bash generate.sh
ls drafts/   # ファイルが1本生成されること
```
