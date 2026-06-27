---
name: agents-tools-quoted-json
description: ~/.claude/agents/ の各 agent frontmatter `tools:` フィールドが bare-bracket (`[Read, Edit]`) や `allowed-tools:` 旧式で不統一なとき、quoted JSON 配列形式に一括正規化したいとき。
author: auto
created: 2026-05-29
version: 1.0.0
status: active
disallowed-tools: Agent
---

## Procedure

1. **現状調査**: `grep -E '^(tools|allowed-tools):' ~/.claude/agents/*.md` で形式不統一の agent を列挙。bare-bracket / quoted / 旧 `allowed-tools:` の 3 種に分類。
2. **正規形を決定**: `tools: ["Read", "Edit", "Bash"]` を採用 (YAML 内 JSON、quote 必須)。
3. **権限最小化を併走**: reviewer 系 (`code-reviewer`, `security-reviewer`, `database-reviewer` 等) は原則 read-only (`["Read", "Grep", "Glob"]`)。Write/Edit/Bash 不要な箇所は剥がす。
4. **一括変換 script**: python で frontmatter YAML を `ruamel.yaml` で読み、`tools` を list 化 + 全要素 str() 化して書き戻す。`allowed-tools:` キーは `tools:` にリネーム。
5. **diff レビュー**: 変換後 `git diff` で 1 ファイルずつ妥当性チェック (特に reviewer 系の権限剥がし)。

## Pitfalls

- YAML 内 JSON は **single-line で書く**。複数行配列は YAML として解釈されて quote が外れる場合あり。
- `Agent` ツールは「agent から agent を呼ぶ」権限。reviewer 系には不要 (循環呼出しのリスク)。
- 既存 agent が `allowed-tools:` (古い key) で動作している場合、リネーム後に Claude Code 再起動するまで反映されない。
- bash の `sed` で YAML 編集すると quote escape を間違えやすい → 必ず YAML parser 経由で書き換え。
- frontmatter の delimiter (`---`) を python 側で誤って消すと agent 自体が壊れる。書き戻し前に `head -1` で確認。

## Verification

- 全 agent で `grep '^tools:' *.md | grep -c '\["'` が agent 総数と一致。
- `~/.claude/scripts/agents-index.sh` で 61 agents (or 実数) の frontmatter validate が全 PASS。
- 変換後 1 agent を実際に呼んで挙動が変わらないこと (権限剥がしで本来必要なツールを落としていないか)。
- `grep -L '^tools:' ~/.claude/agents/*.md` で `tools:` 欠落 agent が 0。
