---
name: md-to-docx-report
description: Markdown（見出し・表・箇条書き・太字・引用）を配布用docxに変換し、再抽出でキー数値を照合する。事業計画・資金資料・定款など配布用の正式文書を作る時に使う。
author: auto
created: 2026-09-05
version: 1.0.0
---

# md-to-docx-report

## 手順
1. Markdownを書く（frontmatterは自動で捨てる。表はGFM、見出しは #/##/###、`👉` 行は黄色地）。
2. 変換（npm `docx` v9 が要る。scratchpadで `npm i docx@9`）:
   ```bash
   node ~/.claude/skills/md-to-docx-report/md2docx.mjs <in.md> ~/Desktop/<出力名>.docx
   ```
   ※ `docx` を resolve できる dir（node_modules がある所）で実行する。
3. 再抽出でキー数値を照合する（「書いたはず」を信じない）:
   ```bash
   python3 -c "import zipfile,re;x=zipfile.ZipFile('<docx>').read('word/document.xml').decode();x=re.sub(r'<[^>]+>','',x);print(all(k in x for k in ['<キー数値1>','<キー数値2>']))"
   ```
4. 配布先は `~/Desktop/`。外部送信は必ず本人の承認を得てから行う。

## 罠
- 本文フォントは Hiragino Sans 固定（Windows側で開くと代替フォントになるが崩れない）。
- 表の1行目をヘッダー扱い（灰色地）。`|---|` 行は自動で捨てる。
- pandoc も python-docx もこのMacには無い。入れずに `docx` npm で済ませる。
