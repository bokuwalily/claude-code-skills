---
name: transcript-usage-cost-tally
description: Claude Code セッションごとの API トークン消費 (input/output/cache_read/cache_creation) を Stop hook で transcript JSONL から集計し、Anthropic 公式料金で USD 換算したいとき。
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent
---

## Procedure

1. **Stop hook 設置**: `~/.claude/hooks/stop_cost_log.sh` で stdin から `transcript_path` を受け取り、JSONL を全行走査。
2. **usage 抽出**: 各 `message.usage` から `input_tokens / output_tokens / cache_read_input_tokens / cache_creation_input_tokens` を取得。cache_creation は `ephemeral_5m_input_tokens` と `ephemeral_1h_input_tokens` に分かれるので個別合算。
3. **model prefix で料金適用** (per million tokens):
   - `claude-opus-*`: $15 / $75 (input/output), cache_read $1.50, cache_create_5m $18.75, cache_create_1h $30
   - `claude-sonnet-4-6` 系: $3 / $15, cache_read $0.30, cache_create_5m $3.75, cache_create_1h $6
   - `claude-haiku-*`: $1 / $5, cache_read $0.10, cache_create_5m $1.25, cache_create_1h $2
4. **JSONL 出力**: `~/.claude/logs/cost-log.jsonl` に `{ts, session_id, cwd, input, output, cache_read, cache_creation, cost_usd, models}` を 1 行追記。
5. **集計**: `~/.claude/scripts/cost-summary.sh` で `today / 7d / 30d` のセッション数・合計 cost を表示。statusline 用 `--short` モードあり。

## Pitfalls

- MAX 定額プラン契約者にとって cost_usd は **実費ではなく消費量目安**。混同しないよう注釈を残す。
- transcript JSONL は 1 行 1 メッセージだが `usage` フィールドは assistant ターンにのみ存在。`null` チェック必須。
- 同じ session 内で model 切替がある (Opus → Sonnet 等) → message 単位で model を見て料金適用。session 全体に 1 モデルを当てると過小/過大評価。
- `cache_read_input_tokens` は `input_tokens` と別カウント。二重計上しない。
- 料金表は Anthropic 公式 (https://www.anthropic.com/pricing) で年次更新あり。ハードコードせずに script 冒頭の定数で集中管理。

## Verification

- 既存 transcript で手動実行 → 想定オーダー ($0.1〜$10/session) の cost が出ること。
- `cost-log.jsonl` の sum と `cost-summary.sh 7d` の合計が一致。
- 同セッションを 2 回走らせて重複追記されないことを確認 (session_id で dedupe)。
- Opus / Sonnet / Haiku 混在セッションで `models` 配列に全部出ているか。

## See Also
-  — ccusage CLIによるリアルタイム残量/Burn rate確認（5hブロック監視・statusline連携はこちら）
