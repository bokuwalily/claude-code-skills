---
name: prune-plugin-clone-temp
description: ~/.claude/plugins/cache が肥大化している / temp_subdir_*.clone が大量に残っている時に発火。プラグイン marketplace の中断クローン残骸を安全に削除する
author: auto
created: 2026-05-31
version: 1.0.0
---

## Procedure
1. 確認: `du -sh ~/.claude/plugins/cache/ && ls -d ~/.claude/plugins/cache/temp_subdir_*.clone 2>/dev/null | wc -l`
2. 実行: `~/.claude/scripts/prune-plugin-clone-temp.sh [MIN_AGE_MIN]`（既定60分。それより新しい temp は in-flight install 保護で残す）
3. snapshot: `~/.claude/scripts/dotfiles-snapshot.sh`

## Pitfalls
- macOS 既定 bash は 3.2 → `mapfile`/`readarray` 不可。`find -exec` で処理すること
- dirname の epoch(ms) が「今」のものは install 進行中の可能性 → `-mmin +N` で必ず除外
- 正規キャッシュ `claude-plugins-official/`(約1.8G) には触れない。消すのは `temp_subdir_*.clone` のみ
- config.json/settings.json から参照されていないことは確認済(残骸は無参照)

## Verification
- 実行後 `du -sh ~/.claude/plugins/cache/` が減っていること
- `ls -d temp_subdir_*.clone | wc -l` が「直近N分内の数」まで減ること
- 初回(2026-05-31): 44残骸 262M を回収、2.0G→1.8G
