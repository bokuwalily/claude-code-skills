---
name: git-commit-helper
description: Conventional Commits 形式（feat/fix/docs/style/refactor/perf/test/chore/ci/build/revert）で commit message を作成・検証する。発火: git commit 失敗 (validator 弾き)、複雑な変更を分割 commit する時、PR タイトル設計時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Write
---

# git-commit-helper

ユーザー環境では `~/.git-hooks/commit-msg` で Conventional Commits を強制している。この validator を通すための定型手順。

## Procedure

1. `git diff --cached --stat` で staged 内容を確認
2. 変更を **機能スコープ単位** に分類:
   - `feat` 新機能 / `fix` バグ修正 / `docs` ドキュメント
   - `style` 整形のみ / `refactor` 振る舞い変えず再構成 / `perf` 性能改善
   - `test` テスト / `chore` 雑務 / `ci` CI 設定 / `build` ビルド / `revert` 取り消し
3. メッセージ形式: `<type>(<scope>): <subject 72字以内>`
   - 例: `feat(scraper): add Uniqlo MediaRSS feed parser`
4. body (optional): なぜ変更したかを 2-3 行で。`-m` を追加して空行で区切る
5. footer (optional):
   - `BREAKING CHANGE: <内容>`
   - `Closes #N` / `Refs #N`
   - `Co-Authored-By: Name <email>`
6. 実行例:
   ```bash
   git commit -m "feat(closet-os): add UNIQLO scraper" -m "MediaRSS endpoint へ切替。HTML スクレイプ失敗の代替経路。"
   ```
   複数行はヒアドキュメント:
   ```bash
   git commit -m "$(cat <<'EOF'
   refactor(memory): split MEMORY.md by domain

   index ファイルが肥大化したので feedback_/project_/reference_ プレフィックスで分割。
   EOF
   )"
   ```

## Pitfalls

- `<type>` は **小文字必須**。`Feat:` は validator NG
- scope に長い文字列（20字超）を入れると弾かれることがある → 短いスラッグで
- 1 commit に複数 type 混在（例: feat + test）は分割推奨。validator は通っても粒度が崩れる
- `--no-verify` で hook をスキップしない（CLAUDE.md / global ルールで禁止）
- emoji prefix（✨🐛 など）は validator 弾き
- subject 末尾の句点（`.` `。`）は付けない
- body は subject から **空行 1 行** 開ける（`-m` を 2 回使えば自動で空行になる）

## Verification

- `git log -1 --format='%s'` で format を目視確認
- hook 単体ベリファイ:
  ```bash
  git log -1 --format='%B' > /tmp/last-msg && ~/.git-hooks/commit-msg /tmp/last-msg && echo OK
  ```
  exit 0 なら通過
- 複数 commit を後追いで確認:
  ```bash
  git log --format='%h %s' origin/main..HEAD
  ```
