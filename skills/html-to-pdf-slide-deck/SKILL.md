---
name: html-to-pdf-slide-deck
description: HTMLから16:9スライド型PDF（提案資料・ポートフォリオ・ピッチデック）を生成するとき。「PDFで提案資料」「スライドにして」「めくって見せる資料」等で発火。file://がPlaywright/Chromeでブロックされる罠の回避込み。
author: auto
created: 2026-06-26
version: 1.0.0
---

## Procedure

1. **スライドHTMLを書く**（1ファイル完結）。各スライド＝1ページ：
   ```css
   @media print {
     @page { size: 1280px 720px; margin: 0; }   /* 96dpiで16:9。px指定が効く */
     html, body { background: #fff; }
     .slide { margin: 0; page-break-after: always; }
     .slide:last-child { page-break-after: auto; }
   }
   .slide { width: 1280px; height: 720px; padding: 70px 88px; overflow: hidden;
            display: flex; flex-direction: column; }
   @media screen { .slide { margin: 24px auto; box-shadow: 0 20px 60px -20px rgba(0,0,0,.6); } }
   ```
2. **ローカルサーバで配信**（`file://`はPlaywright/Chrome headlessでブロックされる）：
   ```bash
   cd <dir> && (python3 -m http.server 8777 >/dev/null 2>&1 &) ; sleep 1
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8777/deck.html   # 200を確認
   ```
3. **headless ChromeでPDF化**：
   ```bash
   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
   "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
     --print-to-pdf="出力.pdf" "http://127.0.0.1:8777/deck.html"
   ```
4. **必ず自己検証**：`Read` ツールでPDFを `pages:"1-8"` 指定して全ページ目視。はみ出し・見切れ・フッター被りを確認。
5. 終わったら `pkill -f "http.server 8777"` でサーバ停止。

## Pitfalls

- **`file://` は使えない**：Playwright MCPは `Access to "file:" protocol is blocked`、Chrome headlessも不安定。必ずhttp配信。
- **縦オーバーフローが最大の敵**：`.slide`は`overflow:hidden`なので超過分は無音で見切れる。グリッドが縦に伸びる系（カード2段・統計4枚）は要注意。実レンダリングで毎回確認。統計は横1列、説明文は短く。
- **`--no-pdf-header-footer`必須**：付けないと日付・URLが各ページに焼き込まれる。
- **フォント**：Google Fonts（明朝＝Shippori Mincho＋ゴシック＝Zen Kaku Gothic New 等）はネット接続時のみ。オフライン提示があるならローカル埋め込みを検討。
- **スクショ検証時のreveal罠**：IntersectionObserverの`opacity:0`初期値は`html.js`でゲートし、JS無効/印刷時は表示させる（でないとPDF/フルページスクショで内容が消える）。

## Verification

- `Read` でPDF全ページを画像表示し、(1)見切れゼロ (2)フッターと本文が被らない (3)数字・固有名詞が実データ通り、を目視確認してから完了宣言する。
