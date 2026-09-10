---
name: solomaker-html-paste
description: solomaker.dev の記事に Markdown を「貼るだけで見出し/太字/区切り/箇条書きが効く」状態で入稿したいとき。maker-daily記事のsolomaker入稿、または「solomakerで#が素で出る/段落が二重に空く」問題を直すときに発火。
author: auto
created: 2026-06-27
version: 1.0.0
---

## Procedure

solomaker.dev の記事エディタは **TipTap(ProseMirror)**。挙動は実機検証済み：
- **プレーンテキストのMarkdownは解釈しない** → `## 見出し` を貼ると `<p>## 見出し</p>` のまま（`#`が素で出る）
- **HTML貼り付けは完全対応** → クリップボードに `text/html` が乗っていれば `<h2>/<strong>/<hr>/<ul><li>/<a>` を正しく取り込む

なので入稿は **markdown→HTMLに変換し、HTMLでコピー→貼り付け** する。

1. ヘルパーで貼り付け用HTMLページを生成（タイトル/本文をワンクリックでコピーできるボタン付き）:
   ```bash
   python3 ~/.claude/skills/solomaker-html-paste/md-to-solomaker-html.py <記事.md> <出力.solomaker.html>
   ```
   - 事前に `pip install markdown` が要る。システムのpython3に無いなら venv か homebrew python3 を使う。
   - 入力mdの frontmatter `title:` をタイトル欄用に抽出し、本文を `markdown.markdown(..., extensions=["extra","sane_lists"])` でHTML化する。
2. 生成HTMLをChromeで開く（ダブルクリック）。
3. **「①タイトルをコピー」** → solomakerのタイトル欄に⌘V。
4. **「②本文をコピー（見出し付き）」** → 本文に⌘V。見出し・太字・区切り・リンクが効く。

ボタンは `navigator.clipboard.write([new ClipboardItem({'text/html':blob, 'text/plain':blob})])` を使う（file://でもユーザー操作で動く。失敗時は writeText にフォールバック）。

maker-daily パイプラインでは `~/.claude/scripts/maker-daily-stock.sh` が tsukutta=markdownそのまま / solomaker=記録用`.md`＋貼り付け用`.solomaker.html` を自動生成するよう既定化済み。

## Pitfalls
- **生テキストの.mdを貼らない**：`#`が素で出る。必ずHTML経由。
- **段落が二重に空く**のは別問題（空行を貼ると空ブロックになる）。HTML(`<p>`)で貼れば解消。プレーン化で逃げるなら空行を全除去して単一改行にする。
- TipTapは貼付時に `https://` を `http://` に正規化することがある（リンクは張られる。気になればエディタ上で1回直す）。
- frontmatter(`---`で囲むメタ)は本文に貼らない。タイトルはタイトル欄へ。

## Verification
- 生成HTMLの `<article id="body">` に `<h2>` が期待数あるか: `grep -o '<h2>' out.solomaker.html | wc -l`（本文＋JS文字列で2倍になる点に注意）。
- 実機確認したいなら claude-in-chrome で `solomaker.dev/articles/new` を開き、`.ProseMirror` に対し `DataTransfer` に `text/html` を入れた `paste` イベントを dispatch → `querySelectorAll('h2,strong,hr,ul li,a')` が描画されることを確認。終わったら selectAll+delete で消す。
