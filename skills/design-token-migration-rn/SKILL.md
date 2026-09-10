---
name: design-token-migration-rn
description: Expo/React Nativeの既存アプリに後からデザイントークン(余白/文字段/角丸/影)を通す移行の固定型。「見た目を変えずに生リテラルを消す」を機械照合で担保する。本番リリース済みの複数アプリで実施して判明した罠＝grepが`<Text`の改行形式を見逃す・Codexは完了条件に書いた項目しか検証しない・段が足りないと変換が勝手に縮む、を潰す。シミュレータでの実画面確認まで含む(simctlにタップは無い/iOS26のディープリンクは必ず確認ダイアログ/dev-client入りはRelease必須/ビルド並走はbuild.dbロックで全滅)。
author: auto
created: 2026-09-01
version: 1.1.0
---

# RNデザイントークン移行の固定型

本番リリース済みのアプリに後からトークンを入れる時に使う。目的は**一貫性の獲得**であって作り直しではないので、「見た目を変えない」が最上位の制約になる。

## 0. 着手前（最重要）

**既存のテーマを必ず探す。** `create-expo-app` 既定は `constants/theme.ts`、独自命名なら `constants/design.ts` 等。
`ls src/theme.ts src/constants/theme.ts` だけで探すと `design.ts` を見落として「テーマが無い」と誤診する。実際に誤診した。

```bash
find src -path '*/node_modules' -prune -o -type f \( -iname 'theme*' -o -iname 'design*' -o -iname 'colors*' -o -iname 'tokens*' \) -print
grep -oE '"(nativewind|tamagui|@shopify/restyle|react-native-unistyles)"' package.json
```

見つかったら**その流儀のまま拡張する**。新しい `src/theme/` を横に作らない。

**ベースラインを取る。** 変更前に `npx tsc --noEmit` / `npx expo lint` / `npx jest` の exit code と警告件数を控える。
控えないと「自分が壊したのか元からか」が判別できない。lint が元から赤いアプリもある。

exit code は必ず単独行で取る。`cmd | tail; echo $?` はパイプの終了コードを拾うし、zsh に `PIPESTATUS` は無い（`$pipestatus[1]`）。
```bash
npx tsc --noEmit > /tmp/tsc.log 2>&1; echo "exit=$?"
```

## 1. 段は実測から起こす

理想の段でなく**そのアプリで実際に使われている値**から作る。使われていない段は誰も使わない。

```bash
grep -rhoE 'fontSize: *[0-9]+' src --include='*.tsx' | sort | uniq -c | sort -rn
grep -rhoE '(padding|margin|gap)[A-Za-z]*: *[0-9]+' src --include='*.tsx' | grep -oE '[0-9]+$' | sort -n | uniq -c | sort -rn
grep -rhoE 'borderRadius: *[0-9]+' src --include='*.tsx' | sort | uniq -c | sort -rn
```

**段が足りないと移行が勝手に縮む。** 12pxの段が無いと `type="smallBold"` に `style={{fontSize:12}}` を当てる回避が生まれ、
16pxの角丸の段が無いと 12 に丸められる。頻出値を先に段へ入れてから移行する。

`fontWeight` は段と直交する。段に内包する（`smallBold`）か、`weight` プロップを足すかを先に決める。
決めずに始めると `style` 上書きの山になる。

TextInput は ThemedText 化できないので、**文字の実寸を `FontSizes` として別 export** し、段と TextInput の両方がそれを参照する形にすると値が二重管理にならない。

## 2. 参照実装を1ファイル手で作る

逸脱が最多のファイルを自分で完全移行し、それを Codex への「これと同じやり方で」の見本にする。
見本無しで投げると流儀がばらける。

## 3. Codex への投げ方

**完了条件に書いた項目しか検証されない。** 生Text だけ書いて spacing を書かなければ spacing は 23件残る。実際に残った。
毎回この6つを完了条件に列挙する: 生`<Text>` / 生fontSize / 生hex / 生borderRadius / 生spacing / legacy shadow。加えて**空スタイル `name: {}` が0件**。

**`<Text` の grep は `-E '<Text( |>|$)'` を使う。** `'<Text[ >]'` だと
```tsx
<Text
  style={...}
>
```
の改行形式を取りこぼす。この取りこぼしで「0件」と誤報告した。Codex にもこのパターンを渡す。

指示に必ず入れる:
- 中間の値の寄せ方を明示（`6→8, 10→12, 14→16, ちょうど中間なら切り上げ`）。書かないと 26→32 のように最寄りを外す
- **width/height/lineHeight/borderWidth/top/left は余白ではないので対象外**と明記。書かないと寸法まで段に載せる
- 段に無い値は「置換せず理由をコメントに書いて残し、報告せよ」。勝手に近い色・近いサイズへ寄せさせない
- 空スタイルは定義ごと削除し `style={styles.x}` の参照も消す。放置すると死にコードが20件単位で残る
- `borderCurve: 'continuous'` を pill 以外の角丸に添える

## 4. 検証（ここが本体）

Codex の自己申告を信じない。**必ず自分で数える。**「0件」と報告されて実際は残っていた。

```bash
grep -rnE '<Text( |>|$)' src --include='*.tsx' | grep -v themed-text
grep -rn ': *{} *,' src --include='*.tsx'
grep -rnE 'fontSize: *[0-9]|borderRadius: *[0-9]|(padding|margin|gap)[A-Za-z]*: *[1-9]|shadowColor|elevation:' src --include='*.tsx'
```

### 見た目差分の機械照合

目視では追えないので、同名スタイルの実数値を移行前後で突き合わせるスクリプトを書く。
このSKILL.mdと同じディレクトリに置いた2本を使う（リポジトリと base コミットを引数に取る）。

- `check-fontsize-drift.mjs` — ThemedText の type が意味する fontSize と、移行前の style の fontSize を比較
- `check-spacing-drift.mjs` — borderRadius と padding/margin/gap をトークン解決して比較

**罠3つ**:
1. **トークンの実値はアプリごとに違う。** `Radii.sm` が 8 のアプリと 10 のアプリがある。値表を使い回すと全件が偽陽性になる
2. **1行スタイル `name: { flex: 1 },` を正規表現が飲み込む。** 複数行用の `[\s\S]*?^  \},` だけだと次のブロックまで食って偽陽性が出る
3. **`style` は type より後に merge される。** style 側に fontSize が残っていればそれが実効値。type だけ見ると誤検出する

照合で出た差分は1件ずつ判断する。±1〜2px のグリッド寄せは想定内、それ以上は戻す。実際に -5px（記号の20px→段の15px）と -16px（48px間隔→32px）を戻した。

## 5. 段に載せない値は消さずコメントを残す

外部ブランドの規定色（Google/各SNS）、OSのナビゲーション chrome（タブラベル10.5px）、
グリフや線の実寸（3px線の角丸2px、9pxの極小表示）は**テーマの管轄外**。
消さずに理由を1行書いて残す。書かないと次の巡回でまた「逸脱」として潰されにいく。

## 6. スコープを守る

Codex は `npx expo lint` を初回実行すると eslint を勝手に install して `package.json` を書き換える。
既存の lint error を `eslint-disable` で黙らせることもある。**どちらもスコープ外なので取り消すか別コミットに分ける。**
既存 error は「変更前と同数」であることを示して報告する（対処療法で消さない）。

## 7. コミットは層で分ける

`chore(lint): 環境整備` → `refactor(design): トークン追加とコンポーネント抽出` → `refactor(design): 画面の移行`。
1コミットに混ぜると差分が読めない。本番アプリならブランチを切る（`design-system-tokens`）。

## 8. シミュレータで実画面を見る（tsc緑は「見た目が正しい」を何も保証しない）

余白と角丸を±1〜2px動かした変更は、型チェックとテストを全部通過する。実際に描画させるまで確認は終わっていない。
特に **レガシー影 → boxShadow の移行は必ず目視する**。オフセット影（`4px 4px 0`）が出るかは実機でしか分からない。

```bash
xcrun simctl list devices booted                       # 起動中のUDIDを取る
xcrun simctl io <UDID> screenshot out.png              # 撮影
xcrun simctl launch <UDID> <bundleId>                  # 起動
```

### 画面をどう巡回するか

**`simctl` にタップ機能は無い。** そして iOS 26 では `simctl openurl` のディープリンクに必ず
「"App" で開きますか?」の確認ダイアログが割り込む（cold start でも出る）。Return キーの送信では消えない。
ダイアログが残るとアプリの画面更新まで止まるので、**シミュレータごと再起動して消す**（`shutdown` → `boot`）。

タップ無しで画面を回る唯一の実用手段は **初期ルートの一時差し替え**:

1. `src/app/index.tsx` の `Redirect` / `router.replace` の行き先を見たい画面に書き換える
2. **アプリを terminate → launch する**（Fast Refresh だけでは既に遷移済みの画面は変わらない。ここを外すと同じ画面を撮り続ける）
3. 撮影
4. **`git checkout src/app/index.tsx` で必ず戻す**

### Debug か Release か — dev-client の有無で決まる

`package.json` に **`expo-dev-client` があるアプリは Debug ビルドで詰む**。
dev-client が Metro を自動検出せず「No development servers found」で止まり、
接続するにもタップか（ダイアログの出る）ディープリンクが要る。

- `expo-dev-client` **なし** → Debug + Metro + 初期ルート差し替えが使える（一番速い）
- `expo-dev-client` **あり** → `--configuration Release` でビルドする。バンドル同梱で Metro が要らず、本番に近い見た目も得られる。
  ただし Release はルートが焼き込まれるので、**見たい画面を先に固定してからビルドする**（画面ごとに再ビルドになる）

### ビルドを走らせる時の3つの罠

1. **`npx expo` は解決に詰まって無言で止まることがある。** `./node_modules/.bin/expo` を使う
2. **background 実行だと expo が起動しないことがある**（ログが0行のまま、`xcodebuild` も上がらない）。foreground + `timeout 560` で回す。
   `expo run:ios` はビルド後に Metro で常駐するので **timeout で切られる(exit 124)のは正常** — ログに `Installing .../Release-iphonesimulator/*.app` があれば成功
3. **絶対に複数のビルドを同時に走らせない。** `build.db` がロック競合して
   `unable to attach DB ... database is locked` で全部倒れる。
   一度詰まったら `rm -rf <DerivedData>/Build/Intermediates.noindex/XCBuildData` でロックだけ消す（キャッシュは残る）。
   待ち時間を惜しんでビルドを重ねると、かえって最初からやり直しになる

完了判定に `grep -c 'Installing'` を使うと **CocoaPods の "Installing CocoaPods..." に誤反応する**。
`Release-iphonesimulator/[A-Za-z]*\.app` のように成果物のパスで判定する。

## 副産物として拾えるもの

移行中に構造的な重複が見える。潰すと差分が大きく減る。
- 同一のヘッダーボタンが13画面にコピーされている → コンポーネント抽出（ついでに hitSlop で 44pt を確保）
- `Screen` が padding を強制するので各画面が `style={{paddingHorizontal: 0}}` で打ち消している → `padded` プロップ（51箇所が消えた）
- Expo テンプレート残骸（`Collapsible`, `hint-row`）が未使用のまま残っている → 報告に留め、勝手に消さない
