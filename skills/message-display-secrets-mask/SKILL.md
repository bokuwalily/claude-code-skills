---
name: message-display-secrets-mask
description: Claude Code v2.1.152+ の MessageDisplay hook で、表示前のメッセージから secrets (sk-/ghp_/AKIA/AIza/xox 等) をマスクし、巨大コードブロックを collapse する hook を実装するとき。
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent
---

## Procedure

1. **入力 schema 確定**: hook stdin は `{session_id, transcript_path, cwd, hook_event_name, message, role}`。最初は変換せず log だけ取って実物で確認。
2. **出力 schema**: `{"hookSpecificOutput":{"hookEventName":"MessageDisplay","displayContent":"<変換後>"}}` を stdout に。変更不要なら **exit 0 で passthrough** (空 stdout = 原文維持)。
3. **secrets マスク**: 正規表現で `sk-[A-Za-z0-9]+`, `ghp_[A-Za-z0-9]+`, `github_pat_[A-Za-z0-9_]+`, `AKIA[A-Z0-9]+`, `AIza[A-Za-z0-9_-]+`, `xox[a-z]-[A-Za-z0-9-]+` を `[REDACTED]` に置換。
4. **コードブロック collapse**: 250 行超の ` ``` ` ブロックは head 6 行 + `... <N> lines omitted ...` + tail 6 行に圧縮。
5. **例外時 passthrough**: python/jq 失敗・schema 想定外なら必ず `exit 0` で原文維持。hook が表示を止めない設計。

## Pitfalls

- `displayContent` を空文字で返すと画面が空になる → 「変更なし」は **空 stdout + exit 0** であって `displayContent: ""` ではない。
- 正規表現が貪欲だと長い token のあとの空白まで食う → `[A-Za-z0-9_-]+` で word-class を限定し境界明示。
- secrets を「マスクして表示」しても transcript JSONL には生で残る → 真に隠したいなら別途 `transcript-path` を書き換える必要 (副作用大、推奨せず)。
- 250 行閾値は適当に決めず実トラフィックで調整。最初は閾値高め (500+) で誤 collapse を避ける。
- settings.json に配線する前に `echo '{...}' | <hook>.sh` で 3 パターン (passthrough / secrets / collapse) を手動テスト。

## Verification

- passthrough test: 短文 stdin → 空 stdout + exit 0。
- secrets test: `sk-ant-test12345...` を含む stdin → `[REDACTED]` 置換確認。
- collapse test: 300 行のコードブロック含む stdin → 13 行 + 省略行数表記。
- settings.json 配線後、実セッションで `tail -F ~/.claude/logs/message-display.log` で発火確認。
- hook 失敗時 (例: jq 削除) でも Claude Code の表示が止まらない (graceful degradation)。
