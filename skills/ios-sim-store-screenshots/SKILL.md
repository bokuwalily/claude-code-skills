---
name: ios-sim-store-screenshots
description: iOSアプリのApp Store用スクショを「実画面のまま」シミュレータで再撮影し、PILでマーケ枠に合成するときに使う。Expo/RN・ネイティブ両対応。シードデータ込みの特定画面を確実に撮りたい時、既存スクショが旧UIで撮り直したい時に発火。
author: auto
created: 2026-06-21
version: 1.0.0
---

## Procedure

実コンポーネントで「写真やシードデータ入りの特定状態」を撮るのが目的。deep-linkの確認ダイアログと埋め込みバンドルの2大罠を回避する。

1. **撮影専用ルートを作る**（認証/タブ依存を避ける）。例 expo-router: `src/app/shot.tsx` が `useLocalSearchParams().s` で deck/card/match 等を出し分け、実コンポーネント＋ローカル束ねた画像で描画。冒頭で `LogBox.ignoreAllLogs(true)`、各分岐に `<Stack.Screen options={{headerShown:false}}/>`。
2. **状態切替は index リダイレクト＋コールド起動**でやる（deep-linkは確認ダイアログが出る→後述）。`src/app/index.tsx` の `router.replace('/shot?s=deck')` を deck→card→match と書き換え、毎回 `simctl terminate`→`simctl launch` で index の useEffect を再実行させる。
3. **Debugビルドで metro 直結**。`xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug -destination 'id=<UDID>' -derivedDataPath build_dbg CODE_SIGNING_ALLOWED=NO build` → `simctl install` → `simctl launch`。metroログに `iOS Bundled …` が出れば JS が反映されている。
4. **ステータスバーを整える**: `xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --dataNetwork wifi --wifiBars 3`。撮影後 `... status_bar booted clear`。
5. **撮影**: `xcrun simctl io booted screenshot /tmp/x.png`（アニメ画面は launch 後 8-9s 待つ）。Readで目視確認。
6. **マーケ枠に合成**: 既存の `make_store_shots.py`（生1206×2622→紙枠＋見出し＋デバイス）に raw を差し替えて実行。
7. **後片付け**: 撮影ルート削除・index復元・束ねた一時画像削除・metro停止(`pkill -f "expo start"`)・status_bar clear・git status で一時物が残ってないか確認。

## Pitfalls

- **埋め込みバンドルの罠**: 既存インストール済みアプリ(eas/Releaseビルド)は `App.app/main.jsbundle` を埋め込み、metroを叩かない＝JS編集が一切反映されない。`find <App.app> -name '*.jsbundle'` で確認。反映には **Debugビルドで作り直し**が必須。
- **deep-link確認ダイアログ**: `simctl openurl booted "scheme://..."` は「"App"で開きますか？」モーダルを出し、`simctl`にはタップ手段が無く詰む。残ったダイアログはアプリ起動もブロックする→ `simctl shutdown/boot` で消すか、そもそも **index リダイレクト＋コールド起動**で openurl を使わない。
- **make_store_shots の FAB除去**: Expo Go前提の `remove_expo_fab` フォールバックが、FABの無いシム撮影では右上を紙色で塗り＝**レア度バッジ等を消す**。シム撮影時は呼び出しをコメントアウト。
- **アスペクト崩れ**: カードコンポーネントに `flex:1` を渡すと `aspectRatio` を上書きして歪む。`width:'100%'` を渡し親で中央寄せ。
- **ステータスバーの「◄ 別アプリ名」**: 別アプリ経由起動の名残。`status_bar override` で上書きすれば消える。
- Expoのスプラッシュ/権限など **prebuild時に焼かれる設定** はDebug再ビルドだけでは反映されない（ネイティブ生成が要る）。

## Verification

- metroログに `iOS Bundled` が出ている（＝埋め込みでなくJS反映済み）。
- 各 raw を Read で目視し、狙った状態・写真・テキスト・バッジが欠けず出ている。
- 合成後の framed を Read で確認（6.9"=1320×2868）。
- 撮影後 `git status` に撮影ルート/一時画像が残っていない。
