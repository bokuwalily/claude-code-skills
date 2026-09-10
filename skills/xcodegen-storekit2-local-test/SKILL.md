---
name: xcodegen-storekit2-local-test
description: XcodeGen (2.45.4+) で StoreKit2 ローカルテスト設定を行うパターン。.storekit ファイルを project.yml に `storeKitConfiguration` で紐付け、実機課金なしで IAP ゲートを検証する。IAP付きiOSアプリで確立した手順。
author: auto
created: 2026-07-14
version: 1.0.0
status: active
related: xcodegen-project-yml-security-review, expo-free-local-ios-testflight
---

## 問題

StoreKit2 の IAP（in-app purchase）フローを CI / 開発中にテストしたい場合、実機 Apple ID 課金なしで動作確認するには `.storekit` 設定ファイルを Xcode に紐付ける必要がある。XcodeGen を使っているプロジェクトでは `project.yml` 経由でこの設定を行う。公式ドキュメントには XcodeGen 連携手順がほぼ存在しない。

## 前提

- XcodeGen ≥ 2.45.4（`storeKitConfiguration` フィールドが安定サポートされたバージョン）
- Xcode ≥ 15（StoreKit Testing in Xcode 対応）
- `.storekit` ファイルが既にプロジェクトルートに存在すること（なければ Xcode の File > New > StoreKit Configuration File で作成）

## Procedure

### 1. `.storekit` ファイルを作成・配置する

```
ProjectRoot/
├── project.yml
├── Foo.storekit          ← ここに配置
└── Sources/
```

Xcode で作成する場合: **File → New → File → StoreKit Configuration File**

ファイル内で IAP 商品を定義する（例: Premium 購読）:

```json
{
  "identifier" : "com.example.app.premium",
  "type" : "Non-Consumable",
  "referenceName" : "Premium Unlock",
  "localizations" : [
    {
      "displayName" : "プレミアム",
      "locale" : "ja_JP"
    }
  ]
}
```

### 2. `project.yml` に `storeKitConfiguration` を追加する

```yaml
targets:
  MyApp:
    type: application
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - Sources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.example.myapp
    scheme:
      storeKitConfiguration: Foo.storekit   # ← これを追加
```

**注意点**:
- キー名は `storeKitConfiguration`（camelCase・スペルミス注意。`storekit_configuration` や `storekitConfiguration` は無効）
- 値はプロジェクトルートからの相対パス
- `scheme:` の下に置く（`settings.base` の下ではない）

### 3. XcodeGen を実行してプロジェクトを再生成する

```bash
# XcodeGen 未インストールなら
brew install xcodegen

# プロジェクトルートで実行
xcodegen generate
```

### 4. Xcode で StoreKit テスト設定を確認する

1. 生成された `.xcodeproj` を開く
2. **Product → Scheme → Edit Scheme → Run → Options** タブを開く
3. **StoreKit Configuration** に `Foo.storekit` が自動選択されていることを確認

選択されていなければ手動でドロップダウンから選ぶ（project.yml 側の設定ミスの可能性）。

### 5. シミュレータで IAP をテストする

```swift
// StoreKit2 API でのテスト例
let products = try await Product.products(for: ["com.example.app.premium"])
let result = try await products.first?.purchase()
```

`.storekit` ファイルが有効な場合、シミュレータ上で購入ダイアログが表示され、「Ask to Buy」等のサンドボックス動作を確認できる。

## Pitfalls

| 症状 | 原因 | 対処 |
|------|------|------|
| `storeKitConfiguration` が scheme に反映されない | XcodeGen < 2.45.4 | `brew upgrade xcodegen` |
| ビルド後に設定が消える | `xcodegen generate` を忘れてた手動編集 | 必ず `xcodegen generate` 経由で変更する |
| `.storekit` パスが見つからない | 相対パスミス or ファイル未コミット | `ls -la *.storekit` で確認 |
| シミュレータで IAP ダイアログが出ない | Scheme の StoreKit Configuration が未選択 | Edit Scheme → Options で手動選択 |
| iPhone 16 シミュレータが存在しない | Xcode デフォルトシミュレータ未作成 | `xcrun simctl create "iPhone 16" com.apple.CoreSimulator.SimDeviceType.iPhone-16 $(xcrun simctl list runtimes | grep iOS | tail -1 | awk '{print $NF}')` |

## Verification

```bash
# project.yml に storeKitConfiguration が含まれているか
grep -n "storeKitConfiguration" project.yml

# .storekit ファイルが存在するか
ls *.storekit

# XcodeGen バージョン確認
xcodegen --version  # 2.45.4 以上であること

# 生成された xcscheme に設定が反映されているか
grep -r "StoreKitConfigurationFileReference" *.xcodeproj/xcuserdata/ 2>/dev/null || \
grep -r "StoreKitConfigurationFileReference" *.xcodeproj/xcshareddata/ 2>/dev/null
```
