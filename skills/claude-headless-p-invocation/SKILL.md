---
name: claude-headless-p-invocation
description: claude -p ヘッドレス実行で system prompt 全ロード + macOS perl alarm timeout + token 制限考慮した実行パターン。発火: 非対話的に claude を呼ぶ自動化スクリプト / cron で claude を回す時 / シェルから 1-shot 実行する時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Edit Write
---

## Procedure

1. **基本形**: `claude -p "<prompt>" --output-format text` で stdout に結果
2. **timeout 付き** (macOS は gtimeout 推奨, なければ perl alarm):
```bash
perl -e 'alarm shift; exec @ARGV' 300 claude -p "..." || echo "timeout"
```
3. **MAX_THINKING_TOKENS 抑制**: 大型 prompt なら `MAX_THINKING_TOKENS=10000 claude -p ...`
4. **stderr 分離**: `claude -p "..." 2> /tmp/claude-err.log` で error trace 別保存
5. **stdin pipe**: `cat input.md | claude -p "summarize"` でファイル入力
6. **launchd / 自動化から呼ぶなら MCP と hook を切る（必須）**: 文章生成・判定だけならツールは要らない。
```bash
claude -p --model haiku --strict-mcp-config --mcp-config '{"mcpServers":{}}' --allowedTools ''
```
   `--mcp-config '{}'` は `mcpServers: Invalid input` で即死する。**必ず `{"mcpServers":{}}`**。

## Pitfalls

- system prompt 全ロードで cost 高 → 短プロンプトでも 5-50 cents / call
- session 切れ (8:50am reset) で中断 → claude --resume <session-id> で復旧
- `--output-format text` 指定しないと JSON 返ってきて parse 必要
- macOS `timeout` コマンドは GNU coreutils 必要 → `brew install coreutils` で `gtimeout` 提供
- 並列 claude -p は token block を急速消費 → 5h 800k cap 注意
- **launchd 下で毎回タイムアウトする（自前 timeout の SIGTERM = exit 143）のは MCP サーバ/hook の起動待ちが原因**。
  対話セッションでは10秒で終わる同じ生成が、細い env + 高負荷だと数分かかる。stderr は空なので原因が見えない。
  上の Procedure 6 で殺す＋タイムアウト自体も余裕を持たせる（90秒→180秒）。実測 6.5 秒に短縮（2026-07-25 note/social 自動返信の全滅を根治）

## Verification

- exit 0 + stdout 非空 = 成功
- exit 124 (timeout) または非ゼロ = 失敗
- `ccusage blocks --active --json` で block 残量を呼び出し後に確認
