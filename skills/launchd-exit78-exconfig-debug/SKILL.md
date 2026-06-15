---
name: launchd-exit78-exconfig-debug
description: launchd ジョブが「last exit code = 78 (EX_CONFIG)」で KeepAlive クラッシュループする時の診断と修復。プロセスが一切起動せずログも残らない spawn 段階失敗が対象。agentmemory が6日間で15,000回ループした実例（2026-06-11）から抽出。
author: auto
created: 2026-06-11
version: 1.0.0
---

# launchd exit 78 (EX_CONFIG) クラッシュループの診断と修復

## Procedure

1. **状態確認**: `launchctl print gui/501/<label>` で `state = spawn scheduled` / `runs = 大きい数` / `last exit code = 78: EX_CONFIG` を確認。runs が数秒おきに増えていればクラッシュループ。
2. **「spawn 段階の失敗」と確定**: 78 はアプリの exit ではなく launchd 合成の「Service could not initialize」。StandardOut/ErrPath のログが一切成長していない（mtime 凍結）ことが裏付け。手動でスクリプトを実行して正常起動するなら、プログラムは健全で launchd 配下のみ失敗している。
3. **健常ジョブと plist を差分比較**。今回の実例で効いた3軸:
   - **ログパスが TCC 保護領域**（~/Documents, ~/Desktop 等）→ `~/.claude/logs/` や `~/Library/Logs/` へ変更（最有力）
   - **shebang `#!/usr/bin/env bash` が plist の PATH で unsigned な Homebrew bash に解決される** → ProgramArguments を `["/bin/bash", "script.sh"]` に変更（Apple署名インタプリタ明示）
   - `launchctl print` の properties に健常ジョブは `managed LWCR | has LWCR`、失敗ジョブは `has LWCR` 欠落 → 再bootstrapでLWCR再生成
4. **アプリが相対パスでデータを書く場合**は `WorkingDirectory` を明示（launchd 既定 cwd は `/`、MCP shim 起動だと `/tmp` になり再起動でデータ全損する）。
5. **修復手順（順序が重要）**: plist 編集 → `launchctl bootout gui/501/<label>`（ループ停止）→ ポートを掴んでいる孤児プロセスを `lsof -nP -iTCP:<port> -sTCP:LISTEN` で**所有者を再確認してから** kill → `launchctl bootstrap gui/501 <plist>` → `launchctl print` で `state = running` / runs が増えないこと、ログ成長、ポートLISTENを検証。

## Pitfalls

- ポートが開いていても安心しない: エンジンだけ生きて worker 不在の「半生」状態は全エンドポイント 404 を返す。死活はポートでなく **health エンドポイントの HTTP 200** で見る。
- `KeepAlive=true` は spawn 失敗を直さない。ThrottleInterval を 30s 程度入れないと数秒間隔の無限ループで runs が数万に積み上がる。
- plist を `plutil -extract ... -o -` で調べる時、`-o` の引数を間違えると**元の plist を出力で上書き破壊**する（vault-auto-ingest が76バイトのJSON断片になった実例）。調査系 plutil は必ず `-o -`（stdout）か別ファイルへ。
- 再現実行（手動でスクリプトを試す）が孤児プロセスを残してポートを占有し、launchd 復旧を妨げることがある。修復前に `lsof` で掃除。

## Verification

```bash
launchctl print gui/501/<label> | grep -E 'state =|runs =|last exit'   # running / runs=1 / never exited
lsof -nP -iTCP:<port> -sTCP:LISTEN                                      # 所有者が launchd 起動の正規プロセス
curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>/<health> # 200
```
