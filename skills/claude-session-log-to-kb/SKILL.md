---
name: claude-session-log-to-kb
description: Stop hook 経由で Claude Code セッションの会話ログを Markdown 化してナレッジベースに追記するパターン。新規プロジェクトでセッション長期記憶を設けたいとき、または extract_conversations.py 相当の仕組みを構築・デバッグするときに使う。
author: auto
created: 2026-06-11
version: 1.0.0
---

## Procedure

### 1. ディレクトリ構成

```
~/.claude/projects/<project-slug>/     ← Claude Code が自動生成する JSONL セッションログ
~/Documents/my-knowledge-base/
├── extract_conversations.py           ← JSONL → Markdown 変換スクリプト
├── raw/conversations/                 ← 出力先（<label>_<session-id[:8]>.md）
│   └── INDEX.md                       ← 自動生成インデックス
└── logs/                              ← hook 実行ログ
```

### 2. Stop hook の接続（settings.json）

`~/.claude/settings.json` の `Stop` フックで `stop_hooks_combined.sh` を呼び出す。
このスクリプトから `obsidian_stop_sync.sh` が起動し、5分デバウンス後に抽出を実行する。

```json
"Stop": [{"hooks": [{"type": "command", "command": "/path/to/stop_hooks_combined.sh"}]}]
```

### 3. obsidian_stop_sync.sh の多重起動防止パターン

```bash
DEBOUNCE_SEC=300
LOCK="/tmp/obsidian_stop_sync.lock"
STAMP="/tmp/obsidian_stop_sync.last"

# デバウンス: 前回完了から DEBOUNCE_SEC 未満なら skip
if [ -f "$STAMP" ]; then
  last=$(stat -f %m "$STAMP" 2>/dev/null || echo 0)
  now=$(date +%s)
  [ $((now - last)) -lt "$DEBOUNCE_SEC" ] && exit 0
fi

# mkdir ロック（stale は 30 分で自動回収）
if [ -d "$LOCK" ]; then
  lock_age=$(( $(date +%s) - $(stat -f %m "$LOCK" 2>/dev/null || echo 0) ))
  [ "$lock_age" -gt 1800 ] && rmdir "$LOCK" 2>/dev/null
fi
mkdir "$LOCK" 2>/dev/null || exit 0
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
```

`printf '{"decision":"approve"}\n'` を **本体実行前に** 返すことで Claude Code をブロックしない。

### 4. extract_conversations.py のコア処理

```python
PROJECTS_DIR = Path.home() / ".claude" / "projects"
RAW_DIR      = Path.home() / "Documents" / "my-knowledge-base" / "raw"

# ~/.claude/projects/<slug>/*.jsonl を走査
for project_dir in sorted(PROJECTS_DIR.iterdir()):
    label    = normalize_label(project_dir.name)   # human-readable ラベルに変換
    conv_dir = RAW_DIR / "conversations"
    for jsonl_path in sorted(project_dir.glob("*.jsonl")):
        messages = parse_session(jsonl_path)       # type+message フィールドを抽出
        md       = format_session_md(messages, session_id, label)
        out_path = conv_dir / f"{label}_{session_id[:8]}.md"
        out_path.write_text(md)
```

**parse_session のポイント**
- `obj["type"]` が `"user"` または `"assistant"` の行のみ採用
- content が `list` の場合は `type=="text"` ブロックのみ連結（`tool_result` はスキップ）

**正規化ルール**
- `PROJECT_LABELS` ハードコード辞書で優先マッチ
- フォールバック: `-Users-you-` プレフィックスを剥がして残りをラベルに
- `/private/var/folders/`・`/tmp/` 由来は `EXCLUDE_PREFIXES` で除外

### 5. 出力ファイルの形式

```markdown
# <label> - <session_id[:8]>

**日時**: YYYY-MM-DD HH:MM

---

**user**: <テキスト>

**assistant**: <テキスト>

---
```

サイズ降順の `INDEX.md` が `generate_index()` により同フォルダに自動更新される。

### 6. 新プロジェクトへの追加手順

1. `PROJECT_LABELS` に `{"-Users-you-...-<project>": "<label>"}` を追記
2. `stop_hooks_combined.sh` に Codex 版スクリプト (`extract_codex_conversations.py`) も必要なら同様に追加
3. `~/.claude/settings.json` の Stop hook がリポジトリ側 `.claude/settings.json` に上書きされていないか確認

## Pitfalls

- **フル再スキャン**: スクリプトは毎回全 JSONL を走査して上書き出力する。セッション数 800+・corpus 940MB を超えると実行時間が長くなる → `DEBOUNCE_SEC=300` が実質的なスロットル
- **バックグラウンド実行**: `obsidian_stop_sync.sh` は `& exit 0` パターンでバックグラウンド化しているが、サブシェルログは `~/Documents/my-knowledge-base/logs/obsidian-hooks.log` で確認できる
- **TMPDIR 壊れ**: `mktemp` が失敗すると `PAYLOAD` が空になりすべての後続フックが no-op になる。`stop_hooks_combined.sh` では fallback パスを用意している
- **LOCK stale**: プロセス異常終了時に `LOCK` ディレクトリが残る。30分で自動回収されるが、急いで手動クリアするなら `rmdir /tmp/obsidian_stop_sync.lock`
- **`stat -f %m`**: macOS 固有。Linux では `stat -c %Y` に替える

## Verification

```bash
# 最新セッションが変換されているか確認
ls -lt ~/Documents/my-knowledge-base/raw/conversations/ | head -5

# hook 実行ログ（エラー有無）
tail -20 ~/Documents/my-knowledge-base/logs/obsidian-hooks.log

# 手動トリガー（デバウンス解除は STAMP 削除）
rm -f /tmp/obsidian_stop_sync.last
bash ~/.local/bin/obsidian_stop_sync.sh
```
