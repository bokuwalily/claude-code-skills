---
name: plugin-cache-repair
description: "Claude Code 起動時の 'Plugin directory does not exist' エラー（settings.json の enabledPlugins に対して ~/.claude/plugins/cache/<marketplace>/<name>/ が欠落している状態）を検出・修復する。発火条件: そのエラーが転写ログや起動メッセージに出現したとき／.disabled-cache に旧コピーが残っているか分からないとき／月初の cache 健全性チェック時。"
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent Edit Write
---

## Procedure

1. まず `dry` モードで現状を把握する:
   ```bash
   ~/.claude/scripts/plugin-cache-repair.sh dry
   ```
   出力で確認するのは 3 数値: `cache present` / `cache missing` / `restorable` vs `flip to false`。

2. `cache missing` が 0 なら何もしない（healthy）。

3. `cache missing > 0` の場合:
   - `restorable` が出ていれば `.disabled-cache/<name>` から `cache/<marketplace>/<name>/` へ `cp -R` で復元される。
   - `flip to false` が出ていれば `settings.json` 内の該当 `enabledPlugins[key]` が `false` に倒される（プラグイン本体が無いので enable 状態を維持しても起動エラーを誘発するだけ）。

4. 内容を確認したら適用:
   ```bash
   ~/.claude/scripts/plugin-cache-repair.sh apply
   ```
   `settings.json` は `~/.claude/backups/settings.json.before-plugin-cache-repair-<timestamp>` に自動バックアップされる。

5. 再度 `dry` で `cache present == enabled(true) total` になっていることを確認。

## Pitfalls

- **cache のレイアウトは `<marketplace>/<plugin-name>/` 階層**。
  キー `vercel@claude-plugins-official` は `cache/claude-plugins-official/vercel/` を見る。
  平面構造だと思って書くと全件 missing と誤判定するので注意。
- **`.disabled-cache` は marketplace で区切られていない**。直下にプラグイン名だけ。
  だから復元時は `cp -R .disabled-cache/<name>  cache/<marketplace>/<name>` と marketplace を補う。
- **既存 cache は絶対に上書きしない**。スクリプトは `[ -e "$DST" ] && SKIP` を入れてある。手動で実行する場合も同じ姿勢で。
- **`apply` 前に必ず `dry` を読む**。`restorable` と `flip to false` の内訳を確認してから走らせる（特に flip 多発時は別問題の可能性）。
- **bash 3.2 互換のため `mapfile` / 連想配列は使っていない**。改修するときも 3.2 互換を維持する（macOS の `/bin/bash` がまだ 3.2）。
- **`settings.json` 編集は `python3 + json` モジュール経由**。jq での書き戻しはコメントや末尾改行が壊れるので避ける。
- **大規模 flip が出る場合の判断**: 例えば 30 件以上が flip 候補なら、cache ディレクトリ自体が消えた・marketplace 名がリネームされたなどの別障害を疑い、apply の前にユーザーに報告。

## Verification

- `dry` 出力に `all enabled plugins have cache. healthy.` が出ること。
- 直近の `~/.claude/backups/settings.json.before-plugin-cache-repair-*` と現行を `diff` して、flip した key 以外には差分が無いこと:
  ```bash
  diff <(jq -S . ~/.claude/backups/settings.json.before-plugin-cache-repair-*) \
       <(jq -S . ~/.claude/settings.json) | head -40
  ```
- 復元したプラグインが実際に手元で参照可能であること:
  ```bash
  ls ~/.claude/plugins/cache/<marketplace>/<plugin-name>/ | head
  ```
- Claude Code を起動し直して `Plugin directory does not exist` がログから消えていること。
