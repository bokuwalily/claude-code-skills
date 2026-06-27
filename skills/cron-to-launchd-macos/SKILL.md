---
name: cron-to-launchd-macos
description: macOS Sequoia/Tahoe で crontab に登録したジョブが一度も走っていない (system.log の cron 件数 0) ことを検知したとき、launchd plist に移行する手順。
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent
---

## Procedure

1. **死活確認**: `log show --predicate 'process == "cron"' --last 7d` で 0 件なら cron daemon が動いていない。
2. **plist 自動生成**: `~/.claude/scripts/cron-to-launchd.sh dry` で `~/.claude/scripts/launchd-proposed/` に crontab 各行 → `com.<user>.<job>.plist` を出力。bash 3.2 互換 (`while read` ループ、`mapfile` 不使用)。
3. **適用**: `cron-to-launchd.sh apply` で `~/Library/LaunchAgents/` に配置 + `launchctl bootstrap gui/$(id -u) <plist>`。
4. **即時動作確認**: `launchctl kickstart gui/$(id -u)/com.<user>.<job>` で強制実行 → 対応する log file の mtime と PID を確認。
5. **並走防止**: cron 行は残置 (macOS の cron daemon が動いていないので二重実行リスクなし)。ユーザーに `crontab -e` で後日削除を推奨。

## Pitfalls

- `*/N` 周期 (例: `*/5 * * * *`) は `StartCalendarInterval` に直接マップできない → 配列で N 個の Minute entry に展開するか `StartInterval` (秒数) を使う。
- `launchctl list` は legacy API。modern は `launchctl print gui/$(id -u)/<label>` / `launchctl kickstart`。
- `Label` は `com.<user>.<name>` 形式。dot を含まない label は load 拒否される。
- plist の `ProgramArguments` は配列必須 (string 単体は弾かれる)。`StandardOutPath` / `StandardErrorPath` は絶対パスで明示しないと `/dev/null` に消える。
- `gui/<uid>` domain は GUI セッション必須。ヘッドレス常駐は `system/` domain + `/Library/LaunchDaemons/` 配置 (root 権限必要)。
- ⚠️**TCC保護領域に書けない**: launchd起動プロセスは `~/Desktop` `~/Documents` `~/Downloads` へ書くと `PermissionError: Operation not permitted`（exit 1）。Full Disk Access付与は対象が `/bin/bash`/`python3` 等になり広すぎ＆手動GUI操作要。→ **実体を非保護パス(HOME直下 `~/foo` 等)に置き、保護領域には symlink を張る**のが定石（プロセスは実体パスに書く＝TCC回避、ユーザーはDesktopから symlink で見える）。スクリプト内のパス定数は **symlink でなく実体パスを参照**させること。
- ⚠️**`env -i` での再現テストは誤検知する**: 素環境で `claude -p` を回すと「Not logged in」やKeychainアクセス失敗で落ちるが、本物のlaunchd GUIエージェントはセキュリティセッションを保持してKeychainから認証が通る。検証は `env -i` でなく `launchctl kickstart -k gui/$(id -u)/<label>` で**本物のエージェントを実走**させてログ＆`last exit code`を見る。
- claude CLI認証(`~/.local/bin/claude -p`)は**token/env不要**。PATHに `~/.local/bin` とnode(nvm)を通せば、login keychainの "Claude Code-credentials" から自動で認証される（本物launchd下で実績あり）。

## Verification

- `launchctl list | grep com.<user>` で全 plist が load 状態。
- `launchctl kickstart gui/$(id -u)/com.<user>.<name>` 実行直後に log file の mtime が更新されている。
- `automation-health.sh` の cron 死活セクションが ALL GREEN。
- 1 週間後に各 log file の mtime が想定スケジュール通り進んでいる。
