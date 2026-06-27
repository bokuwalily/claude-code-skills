---
name: responsive-overflow-guard
description: Webフロントのレイアウト/CSS/Tailwindを編集したら発火。スマホ表示の横スクロール溢れ・中央ズレを、頼まれる前に機械検出して直す。Next/React等のレスポンシブUI変更時に必須
author: auto
created: 2026-06-05
version: 1.0.0
---

# Responsive Overflow Guard

スマホ表示崩れ（横スクロール溢れ・要素の左寄せ/中央ズレ）は、ユーザー指摘を待たず**完了宣言前に自分で潰す**。
目視は信用しない（後述の500px頭打ち）。機械検出を必ず通す。

## Procedure

1. **静的検査（ゼロ依存・最優先）**: プロジェクトに `scripts/lint-layout.mjs` 系があれば実行。なければ `src` を grep:
   - フットガン: `className="grid ..."` に `sm|md|lg|xl:grid-cols-N` があるのに **base の `grid-cols-N` が無い**
     → モバイルで暗黙の単一 `auto` 列になり、**max-content までコンテナ幅を無視して横溢れ**。`grid-cols-1`(=`minmax(0,1fr)`)を足す。
2. **実ビューポート検査（grid以外＝ナビ左寄せ等も拾う）**: dev/preview を起動し、**Playwright MCP**（`browser_resize`→`setViewportSize`）で真の幅 320/360/390/414 を再現。
   - `document.documentElement.scrollWidth <= clientWidth + 1` を確認（超えたら溢れ）。
   - 溢れたら `getBoundingClientRect().right > clientWidth` の要素を列挙→祖先を辿り `gridTemplateColumns`/`display`/`min-width` を見て犯人特定（推測でCSSをいじらない）。
3. **認証ゲートでローカルに入れない画面**: `_`始まり以外の一時ルートに**同一マークアップ＋実数値**を置いて再現（`_`始まりはNext.jsのprivate folderで404）。済んだら削除。
4. 直したら 2 を再実行し scrollWidth==clientWidth・溢れ0 を確認してから完了宣言。

## Pitfalls
- **ブラウザのウィンドウ縮小(`resize_window`/devtools `resize_page`)は ~500px で頭打ち**。320/390 指定しても実際は500pxで描画され、狭幅でしか出ない溢れを見逃す。真の狭幅は **Playwright MCP の viewport** か CDP device emulation でしか出せない。
- 「ビルド成功」「CSSに新クラスが乗った」≠「スマホで崩れてない」。実幅で scrollWidth を測るまで完了と言わない。
- `.btn`(=`inline-flex`)なタブ/ボタンを`flex-1`セルに置くと中身がセル左端に寄る → リンク側に `flex w-full` を付けて中央化。
- レイアウト変更で**新たな溢れを作り込む**ことがある（横並び化で max-content 増→暗黙auto列が溢れた実例）。変更後は必ず再検査。

## Verification
- [ ] 静的検査 PASS（grid に base 列指定あり）
- [ ] 真の 320/360/390px で `scrollWidth <= clientWidth`（溢れ0）
- [ ] 下ナビ等の主要要素がセル内で中央寄せ（`rect`中心が一致）
- [ ] デプロイ後ライブURLでも本番JS/CSSに修正が反映（）
