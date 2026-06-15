---
name: original-favicon-generation
description: Webアプリ/サイトのオリジナルfavicon・アイコンを作る時。CLIラスタライザ(ImageMagick等)が無い環境でも sharp + png-to-ico だけで favicon.ico/icon.png/apple-icon.png を生成。macのHiragino等で日本語glyphも描ける。Next App Router配線込み。
author: auto
created: 2026-06-10
version: 1.0.0
---

# オリジナルfavicon/アイコン生成（sharp + png-to-ico）

Vercel/Nextデフォルトのままにしない。新規Webアプリでは標準で作る。

## Procedure

1. ツール準備（CLIラスタライザ不要・純JSのみ）：
   ```bash
   npm install sharp png-to-ico   # sharpは既にある事が多い。png-to- icoはico書き出し用
   ```
   - sharp は SVG→PNG をラスタライズでき、**SVG内の `<text>` で日本語フォント(Hiragino Sans等)も描画できる**（要検証：非bgピクセル数で空(tofu)でないか確認）。
   - sharp 単体では .ico を書けないので png-to-ico で 16/32/48 を束ねる。

2. デザイン指針（小サイズ視認性優先）：
   - ブランド色の角丸タイル＋**一字glyph**（漢字1字 or 頭文字）が16-32pxで最も読める。
   - 例：就活ナビ＝terracotta(#C84B31→#B23E28)グラデ角丸タイル＋クリーム(#F8F3EA)の「就」。
   - 内側に薄い白ボーダー(rgba(255,255,255,0.14))で締まる。font-weight 900・font-size≈タイルの58%・余白確保。

3. 生成スクリプト（`scripts/gen-icon.mjs`、glyph/色を引数化して再利用）：
   - 512のSVGを作り sharp で 512(app/icon.png)/180(app/apple-icon.png)/16,32,48→png-to-ico(app/favicon.ico)。
   - `<text x="50%" y="52%" font-family="Hiragino Sans,'Noto Sans JP',sans-serif" dominant-baseline="central" text-anchor="middle">`。
   - 実物は seo-affiliate-site/scripts/gen-icon.mjs を流用。

4. Next App Router 配線：`app/` 直下に `icon.png`/`apple-icon.png`/`favicon.ico` を置くだけで
   Next が `<link rel="icon">` 等を**自動生成**（layout.tsx に手書き不要）。デフォルトの app/favicon.ico は上書き。

5. デプロイ後検証（必須）：
   ```bash
   for p in /favicon.ico /icon.png /apple-icon.png; do
     curl -s -o /dev/null -w "%{http_code} %{content_type} $p\n" "https://<本番>$p"; done
   ```
   3つとも200・正しいcontent-typeを確認。Read tool で icon.png を目視して tofu/崩れが無いか見る。

## Pitfalls
- ImageMagick/rsvg-convert が無い環境が多い→sharpで完結させる。
- sharp の日本語text描画は環境依存。**生成後に必ず目視**（空タイル＝フォント未解決）。ダメなら純ベクターmark(font非依存)に切替。
- .ttc(フォントコレクション)は opentype.js で読めない事がある→sharpのSVG text経由が楽。
- png-to-ico は --no-save で入れてもよいが、scripts/ にスクリプトを残すなら devDependency に入れて再現性確保。
- Vercel: デプロイ後 alias 張り直し＆旧自動ドメインの掃除を忘れない（このプロジェクト固有運用）。

## Verification
本番の /favicon.ico /icon.png /apple-icon.png が全部200。ブラウザタブでデフォルト三角が置き換わってること。
