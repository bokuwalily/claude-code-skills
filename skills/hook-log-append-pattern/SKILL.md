---
name: hook-log-append-pattern
description: Claude Code の Stop/PostToolUse フックから構造化データを JSONL ログに追記する汎用パターン。stop_cost_log.sh / post_audit_log.sh / stop_agent_tracker.sh のような「stdin → parse → append」ループを新規で書くときに参照する。
author: auto
created: 2026-06-15
version: 1.0.0
---

## Procedure

### 1. hook stdin の構造

Stop フック・PostToolUse フック両方とも Claude Code から **標準入力** で JSON ペイロードを受け取る。

```bash
INPUT=$(cat)
[ -z "$INPUT" ] && exit 0   # 空入力は即 exit 0（エラーにしない）
```

| フック種別 | 主要フィールド |
|------------|----------------|
| Stop | `session_id`, `transcript_path`, `cwd`, `hook_event_name` |
| PostToolUse | `tool_name`, `tool_input`, `tool_response`, `session_id` |

### 2. 追記先ファイルの準備

```bash
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/my-feature.jsonl"
```

- `.jsonl` 形式（1行1JSON）にすると `jq` でのフィルタリングが容易
- 月別ファイル分割は `"$LOG_DIR/$(date +%Y-%m).jsonl"` で簡単に実現

### 3. bash + inline python3 パターン（推奨）

外部依存ゼロ。python3 は macOS/Linux 標準搭載。

```bash
export HOOK_INPUT="$INPUT"
export LOG_PATH="$LOG_FILE"

python3 - <<'PY'
import os, sys, json, datetime

try:
    data = json.loads(os.environ.get("HOOK_INPUT", ""))
except Exception:
    sys.exit(0)

# --- 必要フィールドを抽出 ---
sid = data.get("session_id", "")
cwd = data.get("cwd", "")

record = {
    "ts":         datetime.datetime.now().isoformat(timespec="seconds"),
    "session_id": sid,
    "cwd":        cwd,
    # 追加したいフィールドをここに
}

with open(os.environ["LOG_PATH"], "a", encoding="utf-8") as f:
    f.write(json.dumps(record, ensure_ascii=False) + "\n")
PY

exit 0   # フックは必ず 0 で終わる（非0 は Claude Code への拒否シグナル）
```

### 4. transcript_path を使った処理

Stop フックでは `transcript_path` が渡る。存在チェックを必ずする：

```python
tp = data.get("transcript_path", "")
if not tp or not os.path.exists(tp):
    sys.exit(0)

with open(tp, "r", encoding="utf-8", errors="replace") as f:
    for line in f:
        try:
            rec = json.loads(line)
        except Exception:
            continue
        # rec を処理して record に集計
```

### 5. 重複防止（Stop フックで同セッションを二重記録しない）

```python
seen_ids = set()
if os.path.exists(LOG_PATH):
    with open(LOG_PATH) as f:
        for line in f:
            try:
                r = json.loads(line)
                if r.get("session_id") == sid:
                    seen_ids.add(r.get("unique_key"))
            except Exception:
                continue
# 書き込み前に seen_ids チェック
```

### 6. フックの接続（settings.json）

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/my_log_hook.sh"
          }
        ]
      }
    ]
  }
}
```

**PostToolUse** はツール名で絞り込める：

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [{"type": "command", "command": "$HOME/.claude/hooks/audit_log.sh"}]
  }
]
```

## Pitfalls

- **exit 0 を忘れると Claude Code がブロックされる**: フックが非 0 で終了すると操作が拒否される。try/except で必ず `sys.exit(0)` を呼ぶ
- **フルスキャン問題**: Stop フックは毎回 transcript を全行読む。セッションが長い（1000行+）と遅くなる。重い処理は `&` でバックグラウンド化し exit 0 だけ先に返す
- **`stat -f %m` は macOS 専用**: タイムスタンプ取得は Linux で `stat -c %Y`。クロスプラットフォームなら `python3 -c "import os; print(os.path.getmtime(...))"` が安全
- **env 経由の文字列長**: `export HOOK_INPUT="$INPUT"` で渡せるサイズは OS 制限（通常 256KB）。大きなペイロードは tmpfile 経由にする
- **LOG_DIR が存在しない**: `mkdir -p` を常に先頭で実行する。cron/launchd 起動時はホームが確定しないことがある

## Verification

```bash
# 直近エントリを確認
tail -3 ~/.claude/logs/my-feature.jsonl | jq .

# ログの整合性チェック
jq -c . ~/.claude/logs/my-feature.jsonl | wc -l  # 壊れた行があれば jq がエラーを出す

# hook を手動トリガー（Stop hook は stdin が必要）
echo '{"session_id":"test","transcript_path":"","cwd":"/tmp","hook_event_name":"Stop"}' \
  | bash ~/.claude/hooks/my_log_hook.sh
echo "exit=$?"
```
