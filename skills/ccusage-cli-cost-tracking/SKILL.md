---
name: ccusage-cli-cost-tracking
description: 非公式 ccusage CLI で Claude MAX クォータ消費を daily/weekly/blocks で集計・statusline 連携する設計。発火: token 5h block の残量確認 / 週次の出力 token 集計 / cost-guard hook 設計時 / Opus burn rate 警告
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Edit Write
---

## Procedure

1. **インストール**: `npm install -g ccusage` (Node 20+)
2. **基本コマンド**:
   - `ccusage daily` — 当日の input/output/cost
   - `ccusage weekly --json` — 週次 JSON
   - `ccusage blocks --active --json` — 現在の 5h block 状態
3. **statusline 連携** (~/.claude/scripts/statusline.sh):
   - `BLOCK_JSON=$(ccusage blocks --active --json)`
   - `tokenCounts.outputTokens / projection.remainingMinutes / costUSD` を抽出
4. **キャッシュ戦略**: blocks 30s / weekly 5min で statusline 高速化
5. **cost-guard hook 連携**: UserPromptSubmit で閾値超え警告 (500k/800k tokens / $80/hr burn)

## Pitfalls

- ccusage は非公式 → MAX plan の cost は **API 換算値**で実費ではない
- session_id × transcript の重複加算で stop_cost_log と乖離 → ccusage の per-block 値を優先
- node version 不一致で動かない → `command -v ccusage` で nvm fallback
- weekly 集計は ISO week (月曜起点) なので、Anthropic billing と日付差あり
- block 切り替わり時に projection.remainingMinutes が NaN → null check 必須

## Verification

- `ccusage blocks --active --json | jq '.blocks[0].tokenCounts'` で生値確認
- statusline で `5h:Nk(cost)` 表示成功
- cost-guard hook が 800k 超で WARN を stderr に出すこと
