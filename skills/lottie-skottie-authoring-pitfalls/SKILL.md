---
name: lottie-skottie-authoring-pitfalls
description: text-to-lottie (diffusionstudio/lottie) スキルでLottieを手書きする時の落とし穴。背景矩形の二重オフセット、ブラウザ検証方法。アニメJSONがコンポ外に描画される/Chromeタブが落ちる時に発火。
author: auto
created: 2026-06-09
version: 1.0.0
---

## Procedure

text-to-lottie プレイヤー（`npx degit diffusionstudio/lottie <dir>` でscaffold、Skia/Skottieレンダ）でLottieを書く時の確定手順。

1. `public/lottie.json` を書き、`public/controls.json` で slot にラベル付け（`bgColor`, `ballColor` 等）。
2. **座標は「レイヤー `ks.p`」＋「シェイプ内 `p`」が加算される**。レイヤーを `[256,256]` に置いたら、その中の矩形/楕円の `p` は基本 `[0,0]` にする。両方に256を入れると中心が `[512,512]`（右下隅）にずれる。スキル同梱の背景サンプルはこの罠を踏んでいる（layer.p=256,256 かつ rc.p=256,256）→ rc.p を `[0,0]` に直す。
3. スクワッシュ&ストレッチは**レイヤーのアンカーをボール底に**置く：楕円を `p:[0,-50]`（半径50）、layer.a=`[0,0,0]`。layer.s をキーフレームすると底が床に貼り付いたまま潰れる。中心アンカーだと地面にめり込む。
4. 重力イージング: 頂点→着地は ease-in（`o.x:[0.5],o.y:[0]` / `i.x:[1],i.y:[1]`）、着地→頂点は ease-out（`o:[0,0]`/`i:[0.5,1]`）。ループは最初と最後のキーフレーム値を一致させる。
5. 検証は **Playwright MCP** で行う（理由は Pitfalls）。`http://localhost:5173/?frame=N&paused=1` に navigate → `browser_take_screenshot` → 保存先は `~/<file>.png`（`.playwright-mcp/` 指定でもホーム直下に出ることがある。`find ~ -name <file>.png` で探す）→ Read で目視。

## Pitfalls

- **claude-in-chrome のタブが生成直後に消える**ことがある（`tabs_context_mcp createIfEmpty:true` → navigate で "Tab no longer exists"）。リトライ2回で復旧しなければ Playwright MCP に切り替える。Playwright はヘッドレスで安定し、`?frame=` ピン留めと組み合わせて確実にフレーム検証できる。
- JSON が valid でも見た目バグ（コンポ外描画）は出る。**必ず実レンダリングを目視**。頂点フレーム(0)と着地フレーム(op/2)の2枚を撮って位置・スクワッシュ・影を確認。
- シェイプは必ず `ty:"gr"` グループの `it` に入れ、末尾に `tr`（恒等でも必須）。フラットだと真っ白。
- 色は 0–1 RGBA（0–255ではない）。`s` 値は常に配列（スカラーでも `[360]`）。
- 全アニメに背景色コントロール必須：最終レイヤーにフルコンポ矩形＋slotted fill（`bgColor`）。

## Verification

- `node -e "JSON.parse(require('fs').readFileSync('public/lottie.json','utf8'))"` で構文チェック。
- frame=0 と frame=op/2 のスクショ2枚で、対象オブジェクトがコンポ（背景矩形）内に収まっているか目視。背景が右下にずれていたら手順2の二重オフセット。
