---
name: session-handoff
description: 長時間/大規模 autonomous モード中に context 限界が近づいた時の次セッション引継ぎパターン。snapshot + improvement-log + dashboard.md + 次やる候補リストを残して中断する。発火: 改善 phase が 5+ 進んだ時、token 5h block が残量 <100k になった時、ユーザーから「続けて」「永遠に」等の長期指示を受けて 60分以上経過した時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Bash
---

## Procedure

1. 直近の改善を `~/.claude/improvements/log.md` に 1 entry にまとめる
   - フォーマット: `## YYYY-MM-DD HH:MM Phase N — summary`
   - 何を変えたか・なぜか・影響範囲を 3-5 行で
2. `~/.claude/scripts/dotfiles-snapshot.sh` を実行して全変更を git に commit
3. `~/.claude/scripts/dashboard.sh` を実行して最新スナップショット生成
4. `~/.claude/improvements/next-session-todo.md` を新規作成 (or 上書き):
   - 未完了タスクリスト (チェックボックス形式)
   - 次に起動すべき Wave N の Agent 候補
   - 注意事項 (token caps / agent type / 重複避けるべきポイント)
5. user に明示報告: 「現状を `dashboard.md` に保存しました。次セッションで `/cc-weekly` か `~/.claude/improvements/next-session-todo.md` を確認して再開してください」

## Pitfalls

- token block 残量誤判定: `ccusage` の active block 出力で input/output token を必ず実値確認。推測値で判断しない
- 改善ログ追記漏れ → 次セッションで何やったか不明になり、改ざんと誤解されるリスク
- snapshot commit 失敗 (pre-commit validator 弾き等) → 改善内容が git 履歴に残らない。失敗時は validator のエラーを読んで該当ファイルだけ stage から外す
- dashboard は 4h cron で上書きされる可能性あり → snapshot を先に commit すること
- 「続けて」と言われたからといって無限ループしない。physical input が要る項目 (認証コード等) は必ず止まって聞く

## Verification

- `git log -1 ~/Documents/claude-config-snapshots` で最新 commit がこのセッション分か確認
- `cat ~/.claude/improvements/next-session-todo.md` で TODO リスト存在確認
- `~/.claude/dashboard.md` の最終更新時刻が 1 時間以内
- `cat ~/.claude/improvements/log.md | tail -20` で最新 entry が追記されているか確認
