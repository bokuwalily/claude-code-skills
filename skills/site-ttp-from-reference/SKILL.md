---
name: site-ttp-from-reference
description: 「このサイトみたいにして」と参照URLを指定された時に、実物を撮って CSS を実測し、トークン化してから実装する手順。実案件で参照サイトのスタイルを写して「AI味」を消した型。
author: auto
created: 2026-09-05
version: 1.0.0
---

# site-ttp-from-reference

参照サイトを「見た気」で作るとテンプレ（ダーク＋1色＋カードグリッド）に戻る。実測してから写す。

## 手順
1. **viewport 連続スクショ**（fullPage は縮んで読めない）：Playwright 1440x900 で 900px ずつスクロールして `home_00..N.png`。サブページ（製品・顧客）も。
2. **計算済みスタイルを抜く**：`getComputedStyle` で h1/h2/h3/p/button/nav の font-family・size・weight・letter-spacing・line-height・color・bg・radius を JSON に。
3. **CSS を落として grep**：`font-family` の実体（@font-face）、`#hex` の頻度上位25、`border-radius`、`box-shadow`、`@media`。頻出色＝面の色、彩度の低さを確認。
4. Google Fonts の代替を `next/font/google` の font-data.json で在庫確認（例：ES Allianz → Inter Tight）。
5. トークンを `globals.css` の `@theme` に写す。**自作の `.btn` 等は必ず `@layer components`**（外すと Tailwind の `hidden` が負ける）。
6. 写真が無いなら **`codex exec` の内蔵画像生成（無料・人物なし）**で「同じグレーディング」の画像を必要枚数（ヒーロー3＋カテゴリ8など）。プロンプト末尾にスタイル文を共通化して統一する。
7. 実データで全ページを撮り、**自分の目で見る**。スマホは `document.documentElement.scrollWidth` を測り、はみ出しは `getBoundingClientRect().right > vw` で犯人を特定。
8. 日本語見出しは `text-wrap: pretty; word-break: keep-all; overflow-wrap: anywhere`、器は ch でなく px。

## 罠
- 調査エージェントに古いスクショを渡すと「もう直っている点」を指摘して帰ってくる。撮り直してから投げる。
- 参照の「顔写真」は第三者の商品に付けると誤認誘導＝人物なしの静物で代替。
- 数字は実物（DB実数・料率・日数）だけ。統計風の飾り数字はAI味の元。
