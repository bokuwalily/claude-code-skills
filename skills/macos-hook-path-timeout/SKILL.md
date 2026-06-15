---
name: macos-hook-path-timeout
description: macOSでClaude Codeのhookやlaunchdジョブが `node: command not found` / `timeout: not found` で失敗する時に使う。GUI起動アプリの最小PATH問題と、macOSにGNU coreutils(timeout)が無い問題の、検証済み回避策。
author: auto
created: 2026-06-01
version: 1.0.0
---

## Procedure

### 症状1: hook が `/bin/sh: node: command not found`（また brew/その他CLIも）
GUIから起動したClaude Code(.app)が spawn する hook の `/bin/sh -c` は、ログインシェルの
プロファイル(.zshrc)を読まず **最小PATH(`/usr/bin:/bin:/usr/sbin:/sbin`)** しか持たない。
nvm/homebrew にある `node` 等が見えず、プラグイン定義の `node "...mjs"` 系hookが毎回失敗する。

**修正**: `~/.claude/settings.json` のトップレベルに `env.PATH` を足し、hook子プロセスに継承させる。
```json
"env": {
  "PATH": "/Users/<you>/.nvm/versions/node/<ver>/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/<you>/.local/bin"
}
```
Bashツール側はプロファイルを再読込するので pyenv/nvm の順序は壊れない（env.PATHは hook など
プロファイル非読込の子にだけ効く）。nvm versioned path が将来stale化しても `/opt/homebrew/bin/node`
が fallback するので壊れない。

### 症状2: スクリプトの `timeout 60 ...` が効かない（`timeout: command not found`）
macOSは GNU coreutils の `timeout` を**標準搭載しない**。ECCのhooks.md等が前提にしていても不発。

**修正**: `brew install coreutils` で `gtimeout` が入る。スクリプトは
`command -v gtimeout >/dev/null && TIMEOUT_CMD="gtimeout 60"` の形で優先検出させる
（`post_tsc_check.sh` / `skills-auto-update.sh` はこの形。coreutils導入だけで設計通りに起動する）。

## Pitfalls
- `env.PATH` を**短すぎる値**にするとin-sessionのBashが影響を受けうるので、ログインPATHの主要dirを網羅した superset にする。設定前に `cp settings.json backups/` でバックアップ。
- `settings.json` はプラグイン(例: agentmemory/remember)が**ライブ書換**することがある。Edit前に再Readして楽観ロックに従う。`env` ブロックはjq round-tripでも保全される。
- nvm の versioned path をハードコードすると node メジャー更新でstaleになる → 必ず `/opt/homebrew/bin` も含める。

## Verification
```bash
# 旧最小PATHで再現（not found が出る）
env -i HOME="$HOME" /bin/sh -c 'PATH="/usr/bin:/bin"; node --version'
# 新env.PATHで解決（バージョンが出る）
env -i HOME="$HOME" /bin/sh -c 'PATH="<settings.jsonのenv.PATH>"; node --version && command -v node'
# timeout
command -v gtimeout && echo "post_tsc_check 等の timeout 分岐が起動する"
jq -e . ~/.claude/settings.json >/dev/null && echo "settings.json VALID"
```
