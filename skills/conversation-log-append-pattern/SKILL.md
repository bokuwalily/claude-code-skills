---
name: conversation-log-append-pattern
description: ~/.claude/improvements/log.md への Phase エントリ追記パターン。autopilot タスク完了後に「### Phase N — <summary>」形式のエントリを追記するときに参照する。hook-log-append-pattern（JSONL）と対をなす Markdown 構造化ログ版。
author: auto
created: 2026-06-18
version: 1.1.0
---

## Procedure

### 0. 既存スキルの確認（新規作成タスクの場合）

```bash
ls ~/.claude/skills/auto/ | grep -i log
```

同名スキルが既存なら **新規作成せず本スキルを patch** する（version を上げ、Pitfalls/Procedure に追記）。

### 1. 現在の Phase 番号を取得（競合防止付き）

```bash
# ロック取得（並行 autopilot タスクとの競合を防ぐ）
LOCK="/tmp/log_append.lock"
exec 9>"$LOCK"
flock -n 9 || { echo "ERROR: log_append.lock taken — retry later"; exit 1; }

LAST_PHASE=$(grep -oE '^### Phase [0-9]+' ~/.claude/improvements/log.md \
  | tail -1 | grep -oE '[0-9]+')
NEXT_PHASE=$((LAST_PHASE + 1))
echo "Next Phase: $NEXT_PHASE"
# ロックは append 完了後に解放される（スクリプト終了で自動解除）
```

### 2. エントリテンプレート

```markdown
### Phase N — <1行の要約タイトル>
- 種別: fix | feat | refactor | infra | safety | cleanup | verify
- 対象: `触ったファイルやディレクトリ`（新規作成なら「新規作成」と明記）
- なぜ: 動機・root cause（「〜がなかった」「〜で詰まった後の回避策」等）
- 何を: 具体的に変更した内容（コマンド名・関数名・ステップ数等を含める）
- 検証: 実行したコマンドと結果（例: `ls path/to/file` ✓, `bash -n script.sh` → OK）
- ロールバック: 戻す手順（変更なし検証のみの場合は「変更なし」と記載）
```

### 3. log.md への追記（bash heredoc）

```bash
LOG="$HOME/.claude/improvements/log.md"
cat >> "$LOG" <<EOF

### Phase ${NEXT_PHASE} — <タイトル>
- 種別: feat
- 対象: \`path/to/file\`（新規作成）
- なぜ: <動機>
- 何を: <変更内容>
- 検証: \`コマンド\` → 結果 ✓
- ロールバック: \`rm path/to/file\`
EOF
```

### 4. 追記内容の確認

```bash
tail -10 ~/.claude/improvements/log.md
```

### 5. （任意）dotfiles/config のスナップショットを取る

`~/.claude/` 配下を変更したなら、自分のバックアップ手順（git commit / rsync / snapshot script など）を実行しておく。ログ追記だけでは設定変更そのものは保存されない。

### 6. （任意）autopilot-history.jsonl に記録

Phase 追記は通常 autopilot タスクの最終ステップとして行う。
必要に応じて `autopilot-history.jsonl` にも追記:

```bash
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Phase ${NEXT_PHASE} — <タイトル>" \
  >> ~/.claude/logs/autopilot-history.jsonl
```

## Pitfalls

1. **Phase 番号の重複**: `grep` で最後の番号を取得してから +1 する。手動で数えると飛び番になりやすい。
2. **heredoc 内のバックスラッシュ**: `\`` や `\$` は heredoc の外では不要。`<<'EOF'` にすると展開されないが変数も展開されなくなるため `<<EOF` + 変数はバックスラッシュエスケープで対応。
3. **空行の欠落**: 直前エントリとの間に空行がないと Markdown レンダリングが乱れる。heredoc 先頭に空行を入れること。
4. **バックアップの取りこぼし**: 自作のスナップショット/バックアップ手順を使っているなら、mtime 条件などでスキップされていないか確認する。ログ追記直後に実行すること。
5. **「## YYYY-MM-DD」旧形式との混在**: log.md 先頭は旧形式（`## YYYY-MM-DD HH:MM | ...`）が残っている。Phase 形式は `### Phase N —` で区別できるため grep パターンを正確に指定する。
6. **並行 autopilot タスクによる Phase 番号衝突**: 複数の headless タスクが同時に `LAST_PHASE` を読むと同じ番号で append される。`flock` ロックで直列化する（Procedure §1 参照）。

## Verification

```bash
# Phase 番号が正しく増えているか
grep -E '^### Phase [0-9]+' ~/.claude/improvements/log.md | tail -3

# 最新エントリが完全か（6フィールド全て存在）
tail -10 ~/.claude/improvements/log.md | grep -c '^\- '
```
