---
name: chrome-ext-store-assets
description: Chrome拡張(MV3)のストア出品素材を外部ツール無しで作る。SVGロゴ→PNGアイコン量産・1280x800スクショ・提出ZIP。rsvg/imagemagick/sharpが無いmacOSで発火。
author: auto
created: 2026-06-10
version: 1.1.0
---

## Procedure

macOSに `rsvg-convert`/`imagemagick`/`inkscape`/`sharp` が無くても、**Google Chromeヘッドレス＋sips** だけでベクター→透過PNGを量産できる。

### 1. アイコン: SVG → 透過PNG（16/48/128/512）
`icons/icon.svg`（512 viewBox）を用意し、`icons/build-icons.sh`:
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --default-background-color=00000000 \
  --screenshot="$DIR/icon512.png" --window-size=512,512 "file://$DIR/icon.svg"
for s in 128 48 16; do sips -z "$s" "$s" "$DIR/icon512.png" --out "$DIR/icon${s}.png"; done
```
- `--default-background-color=00000000` で透過。`--headless=new` 必須。
- SVGに `width="512" height="512"` を入れ、window-sizeと一致させる。
- 縮小はsips（Lanczos相当で綺麗）。デザインは16pxで潰れないフラットなベクターに。

### 2. ストアスクショ（1280x800）: HTML → PNG
`store/promo.html`（`html,body{width:1280px;height:800px}`、JPは `font-family:"Hiragino Sans"`）を作り:
```bash
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --screenshot="store/screenshot-1280x800.png" --window-size=1280,800 "file://$PWD/store/promo.html"
```
アイコンPNGは `<img src="../icons/icon512.png">` で埋め込める（file://相対パスOK）。

### 3. 提出ZIP（実行ファイルのみ）
```bash
zip -r dist/<name>-v<ver>.zip manifest.json src/ popup/ icons/icon16.png icons/icon48.png icons/icon128.png
```
test/・*.md・store/・node_modules・icon.svg/512は**除外**（提出物を最小に）。

### 4. manifest（出品前チェック）
- `"icons"` と `"action".default_icon` に 16/48/128 を配線。
- 権限は最小化: 完全ローカル拡張なら `host_permissions` は不要（content_scriptsのmatchesだけで注入される）。未使用の `activeTab` も削除。
- 本番では `console.log` を `const DEBUG=false` でゲート（審査・規約対策）。

### 5. webapp/複数アプリへの一括転用（Tsukutta等アプリ共有サイト）
拡張だけでなくwebアプリの紹介プロモ画像も同テンプレで作れる。レイアウトは「左=ブランド行＋h1(hl強調)＋chips＋バナー / 右=ブラウザ枠のUIモック」。
- **アイコンはCSSバッジで描く**（`icon.svg`不要）: `width:74px;border-radius:19px;background:<brandGrad>` に文字/絵文字。各アプリの素材探索を省ける。
- **N枚一括生成**: `gen.mjs` に `APPS=[{slug,name,accent,bg,icon,h1,sub,chips,url,mock,css}...]` の配列を持たせ、共通`page(a)`関数でHTML書き出し→bashでChromeループ。右モックだけ各アプリ固有に作り込む（実画面でなくそれっぽいUI再現で十分）。
- **見出しの折り返し**: 日本語h1は語の途中で割れやすい。`font-size:47px`前後＋`<br>`で2行に収め、各行8〜9文字以内。生成後は必ず画像をReadで目視確認。
- **`--force-device-scale-factor=2`** で2倍解像度の高精細PNG（1280x800指定→実2560x1600）。

**今後の最短ルート＝Tsukutta MCP**（導入済 user scope）：新セッションで「このプロジェクトをTsukuttaに共有して」と言えば `mcp__tsukutta__*` がソース分析→secret除去確認→アップロードまで自動。デプロイ・審査不要。以下の手動手順はMCP不可時/UIで微調整したい時のフォールバック。詳細は memory `reference-tsukutta-mcp`。

Tsukutta(tsukutta.app)の手動投稿仕様（2026-06時点・要ログイン）:
- カテゴリは6種: 業務効率化ツール / データ処理・変換 / ゲーム / 生活便利ツール / 学習・教育 / その他。
- 「ファイル」タブ=**.zip/.ipa/.apk 必須・最大50MB**＋URL任意。「URL」タブ=本番URLで投稿（フル項目あり）。
- **Next.js(SSR)アプリはzip単体で動かない→URLタブ**で本番URL投稿が正。Phaser/Vite等の静的`dist/`はzip可。ソース一式zipは`.env`流出リスクで避ける。
- スクショ最大5枚。実投稿(フォーム入力)は外部書込みなので、依頼が「素材作成」なら素材だけ用意し公開操作はしない。

## Pitfalls
- `sips` はSVGを直接変換**できない**（PNG/JPEG/PDFのみ）。SVGは必ずChromeでラスタライズしてからsips。
- 古い `--headless`（=旧式）だと透過や描画が崩れる。`--headless=new` を使う。
- PIIを扱う拡張は**プライバシーポリシーURLが審査必須**。完全ローカルでも「収集する個人情報の種類」開示と3宣言（売らない/無関係目的に使わない/信用判断に使わない）が要る。
- content_scriptsの `matches:["<all_urls>"]` は「全サイトでデータ読み取り/変更」警告が必ず出る。単一用途と権限justificationを明記して説明する。
- 提出はデベロッパー登録($5)＋手動アップロードが必要。CLIから自動submitはしない（外部・課金・本人アカウント）。

## Verification
- `sips -g pixelWidth -g pixelHeight icons/icon128.png` で各サイズ確認。
- アイコンPNGを実際に目視（16pxで識別できるか）。
- `unzip -l dist/*.zip` でtest/secret/docsが混入していないか確認。
- 拡張をchrome://extensionsでunpackedロード→アイコン表示＆コンソールにDEBUGログが出ないこと。
