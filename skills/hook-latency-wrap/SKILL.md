---
name: hook-latency-wrap
description: Claude Code の任意 hook (PostToolUse / Stop / UserPromptSubmit 等) の実行時間と失敗率を観測したいとき、bash $EPOCHREALTIME ベースの透過 wrapper で計測する手順。
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent
---

## Procedure

1. **wrapper script 設置**: `~/.claude/scripts/hook-latency-wrap.sh <real_hook_path> "$@"` で stdin を保持しつつ実 hook を exec 前後で `$EPOCHREALTIME` を取得。差分を µs 精度で `~/.claude/logs/hook-latency.jsonl` に追記 (`ts/hook/duration_ms/exit_code`)。
2. **settings.json の配線書き換え**: 該当 hook の `command` を `~/.claude/scripts/hook-latency-wrap.sh ~/.claude/hooks/<real>.sh` に差し替え。複数 hook 同時 wrap 可能。
3. **stdin 透過**: wrapper は `cat | <real_hook>` ではなく `exec` 直前まで stdin を保持し、実 hook に丸ごと渡す (Claude Code hook protocol を壊さない)。
4. **失敗時 passthrough**: 実 hook の exit code をそのまま返す。wrap 自体は失敗しても `exit 0` で hook chain を止めない。
5. **レポート集計**: `~/.claude/scripts/hook-latency-report.sh` で過去 7d を hook 別に p50/p95/max/fail rate に集計。

## Pitfalls

- bash 5+ の `$EPOCHREALTIME` を使うこと。macOS 標準 bash 3.2 では未定義 → `/opt/homebrew/bin/bash` shebang を明示する。python3 を spawn すると 30-50ms オーバーヘッドが追加で乗る (本末転倒)。
- wrap 自体のオーバーヘッドは ~20ms。1ms 単位の精度を求めるなら別途差し引き必要。
- `exec` 前に `>>` で log に追記すると実 hook の stdout/stderr を巻き込む → 計測ログは別 fd (e.g. `exec 9>>...`) か wrap 終了後に書く。
- `stop_notify.sh` のような非同期 hook は wrap の終了タイミングと実完了がズレる場合あり。fire-and-forget なら計測無意味。

## Verification

- `bash -n ~/.claude/scripts/hook-latency-wrap.sh` で構文 OK。
- 試験 hook で `echo '{}' | ~/.claude/scripts/hook-latency-wrap.sh ~/.claude/hooks/<target>.sh` 実行 → log に entry 1 行追加。
- 通常 hook 発火 (Edit/Stop 等) 後に `tail ~/.claude/logs/hook-latency.jsonl` で記録確認。
- `hook-latency-report.sh` で p95 が想定範囲 (< 500ms 推奨) に収まっている。
