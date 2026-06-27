---
name: llm-content-pipeline-quality-gate
description: LLMでコンテンツを自動生成し、品質スコアが閾値未満なら棄却・再生成するパイプラインをシェルスクリプトで組むとき。claude -p による1コール生成→スコア抽出→閾値ゲート→型/テーマローテーションログまで一連を含む。
author: auto
created: 2026-06-20
version: 1.0.0
status: active
---

## Procedure

### 1. ディレクトリ構成

```
project/
├── generate.sh          # 生成スクリプト本体
├── daily.sh             # launchd ラッパー（N本まとめて起草）
├── knowledge/           # LLMへ渡すナレッジファイル群
│   ├── persona.md
│   ├── style.md
│   └── quality-rubric.md
├── lib/
│   └── parse_avg.py     # SCORE行からavgを抽出
├── drafts/              # 生成済み下書き（人間レビュー前）
├── logs/
│   ├── gen.log          # 全生成ログ（OK/REJECTED）
│   ├── posted-types.log # 使った型ログ（重複回避）
│   └── posted-topics.log
└── PAUSED               # このファイルがあると全処理を停止
```

### 2. プロンプト組み立てパターン

```bash
# ナレッジを束ねる
KNOW=""
for f in persona style quality-rubric; do
  KNOW+=$'\n\n===== '"$f"$' =====\n'"$(cat "knowledge/$f.md")"
done

# grounding（一次情報）を差し込む
GROUND=""
for src in "$HOME/.remember/recent.md" "$HOME/.remember/now.md"; do
  [ -f "$src" ] && GROUND+=$'\n\n--- '"$(basename "$src")"$' ---\n'"$(head -c 4000 "$src")"
done
[ -z "$GROUND" ] && GROUND="（作業ログ無し）"

# 型・テーマの直近ログを読み込んで重複回避
LAST_TYPES=$(tail -3 logs/posted-types.log | paste -sd '、' -)
LAST_TOPICS=$(tail -8 logs/posted-topics.log | paste -sd '、' -)
```

### 3. LLM呼び出し（リトライ付き）

```bash
CLAUDE="${CLAUDE:-~/.local/bin/claude}"
MODEL="${MODEL:-sonnet}"
GEN_TIMEOUT="${GEN_TIMEOUT:-420}"

resp_is_valid() {
  local r="$1"
  [ -z "$r" ] && return 1
  printf '%s' "$r" | grep -q '^TYPE:' || return 1
  printf '%s' "$r" | grep -q '^SCORE:' || return 1
  printf '%s' "$r" | grep -qiE 'request timed out|usage limit|rate limit' && return 1
  [ "$(printf '%s' "$r" | wc -c | tr -d ' ')" -lt 600 ] && return 1
  return 0
}

RESP=""
for attempt in 1 2 3; do
  RESP=$(timeout "$GEN_TIMEOUT" "$CLAUDE" -p "$PROMPT" \
         --allowedTools WebSearch --model "$MODEL" 2>/dev/null)
  resp_is_valid "$RESP" && break
  echo "[gen] 生成失敗(試行${attempt}/3)。再試行…" >&2
  RESP=""
done
resp_is_valid "$RESP" || { echo "[gen] 3回試行後も失敗。" >&2; exit 1; }
```

### 4. スコア抽出 (lib/parse_avg.py)

```python
#!/usr/bin/env python3
"""SCORE行(JSON or 雑な文字列)からavgを取り出す。失敗時は0。"""
import sys, json, re

s = sys.stdin.read().strip()
avg = 0
try:
    avg = float(json.loads(s).get("avg", 0))
except Exception:
    m = re.search(r'"?avg"?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)', s)
    if m:
        avg = float(m.group(1))
print(avg)
```

### 5. 品質ゲート

```bash
SCORE=$(printf '%s\n' "$RESP" | sed -n 's/^SCORE: *//p' | head -1)
AVG=$(printf '%s' "$SCORE" | python3 lib/parse_avg.py 2>/dev/null)
[ -z "$AVG" ] && AVG=0

MIN_AVG="${MIN_AVG:-7.0}"
if python3 -c "import sys; sys.exit(0 if float('$AVG') >= float('$MIN_AVG') else 1)"; then
  :  # 通過
else
  echo "[gen] 品質avg=$AVG < $MIN_AVG。棄却。" >&2
  echo "$(date '+%F %T')	REJECTED_LOWSCORE	avg=$AVG" >> logs/gen.log
  exit 2
fi
```

### 6. ファイル出力とローテーションログ記録

```bash
TS=$(date +%Y-%m-%d_%H%M%S)
FNAME="drafts/${TS}.md"
{
  printf '<!-- TYPE: %s | SCORE_AVG: %s | gen: %s -->\n\n' "$TYPE" "$AVG" "$TS"
  printf '%s\n' "$BODY"
} > "$FNAME"

echo "$TYPE"  >> logs/posted-types.log
echo "$TOPIC" >> logs/posted-topics.log
echo "$(date '+%F %T')	OK	avg=$AVG	$TYPE	$TOPIC	$FNAME" >> logs/gen.log
```

### 7. launchd ラッパー (daily.sh)

```bash
#!/bin/bash
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
N="${DAILY_N:-2}"

# launchd最小環境でnvmを通す
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

# PAUSEDキルスイッチ
[ -f "$DIR/PAUSED" ] && { echo "[daily] PAUSED"; exit 0; }

ok=0
for i in $(seq 1 "$N"); do
  bash "$DIR/generate.sh" && ok=$((ok+1))
  sleep 2
done
echo "[daily] 起草 $ok/$N 本"
```

## Pitfalls

- **SCORE行のパース**: LLMが `SCORE: {"avg":7.2}` の形式を守らないことがある。`parse_avg.py` はJSON失敗時に正規表現フォールバックを持たせる
- **リトライ中のtimeout累積**: `GEN_TIMEOUT` × 3 が最大待ち時間になる。launchd の `StartInterval` より小さく設定すること
- **posted-types.log の肥大化**: `tail -3` で読むだけなのでサイズは問題ないが、定期的に `wc -l` で確認すると安心
- **nvm PATH**: launchd は `~/.zshrc` を読まない。`NVM_DIR` を `.env` に書くか daily.sh で直接 source する
- **PAUSEDファイル**: 緊急停止用。`touch PAUSED` で全処理が止まる。解除は `rm PAUSED`

## Verification

```bash
# ドライラン（テストレスポンスを差し込む）
export X_ARTICLE_TEST_RESPONSE='TYPE: 実録
TOPIC: Claude Code自動化
SCORE: {"hook":8,"value":7,"avg":7.5}

# テスト記事本文
'
bash generate.sh
# → drafts/ にファイルが出力されることを確認

# 品質ゲートのテスト（avg 5.0 → 棄却されること）
export X_ARTICLE_TEST_RESPONSE='TYPE: 実録
TOPIC: テスト
SCORE: {"hook":5,"value":5,"avg":5.0}

# 低品質記事
'
bash generate.sh
# → exit code 2 で終了し、drafts/ に出力されないことを確認

# ログ確認
cat logs/gen.log
```
