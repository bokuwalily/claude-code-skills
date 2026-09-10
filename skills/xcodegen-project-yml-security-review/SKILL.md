---
name: xcodegen-project-yml-security-review
description: iOS XcodeGen の project.yml diff をセキュリティレビューするとき。変更がビルド番号・Info.plist キー・権限文字列などに限定される場合の判定フロー。
author: auto
created: 2026-06-29
version: 1.0.0
status: active
---

## Procedure

1. **変更種別を分類する**
   - `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION` のみ → ビルド番号バンプ。セキュリティ影響ゼロ。終了。
   - `NSXxx` キー（Info.plist 権限）の追加・変更 → Step 2 へ。
   - その他（依存ライブラリ・ビルドフラグ・entitlements）→ 該当箇所を個別確認。

2. **権限キーの範囲を確認する**
   - `NSPhotoLibraryAddUsageDescription` = **追加専用**（Photos への書き込みのみ）
   - `NSPhotoLibraryUsageDescription` = **読み書き**（より広い権限）
   - 追加された権限キーが最小権限原則に沿っているか確認する。
   - 権限キー対照表（旧 ios-permission-key-security-matrix から吸収）:

   | 権限キー | アクセス範囲 | リスク |
   |---|---|---|
   | `NSPhotoLibraryAddUsageDescription` | 追加専用 | 低 |
   | `NSPhotoLibraryUsageDescription` | 全読み書き | 中〜高 |
   | `NSCameraUsageDescription` | カメラ撮影のみ | 低〜中 |
   | `NSMicrophoneUsageDescription` | マイク録音 | 中 |
   | `NSLocationWhenInUseUsageDescription` | 使用中のみ位置情報 | 低〜中 |
   | `NSLocationAlwaysUsageDescription` | 常時位置情報 | 高 |
   | `NSContactsUsageDescription` | 連絡先読み取り | 高 |
   | `NSFaceIDUsageDescription` | Face ID | 中 |

   - `ITSAppUsesNonExemptEncryption: false` は輸出コンプライアンス申告でありセキュリティ上問題ない。
   - 使用説明文字列に `\(variable)` 等の文字列補間が入っていないか（内容注入リスク・稀）。

3. **Usage Description 文字列を検査する**
   - 静的リテラルか（変数展開・文字列結合がないか）確認する。
   - `NSXxxUsageDescription` は Apple が要求する静的プロンプト。**省略するとクラッシュ**（セキュリティ改善ではない）。
   - 日本語など多言語文字列でも同様に扱う。

4. **セキュリティ関連要素のチェックリスト**（該当なしでも「なし」と明示する）
   - [ ] エントリーポイント（URL schemes、Universal Links、Shortcuts など）の追加・変更
   - [ ] データシンク（ファイル書き込み・ネットワーク・Keychain・クリップボード）
   - [ ] バリデーター・サニタイザーの変更
   - [ ] IAM バインディング・entitlements の変更
   - [ ] CI/CD トリガーへの影響（スクリプト実行など）
   - [ ] 実行コードパスの追加（`SWIFT_FLAGS`・スクリプトフェーズなど）

5. **判定と報告**
   - 上記チェックリストがすべて「なし」なら → **No findings** と報告し理由を 1〜2 行で添える。
   - 該当ありなら → 重大度（CRITICAL/HIGH/MEDIUM/LOW）と影響範囲を報告する。

## Pitfalls

- `NSPhotoLibraryAddUsageDescription` の**不在**はクラッシュを引き起こすため、削除は「セキュリティ強化」ではない。
- XcodeGen の `project.yml` 変更はコード変更なしでも Entitlements や Capability を追加できる。`entitlements:` セクションが変更されていないか必ず確認する。
- `MARKETING_VERSION` と `CURRENT_PROJECT_VERSION` は別物。CFBundleShortVersionString（表示版）と CFBundleVersion（ビルド番号）に対応する。

## Verification

```bash
# 権限キーの追加分だけ抽出して確認
git diff HEAD~1 -- project.yml | grep '^+' | grep -E 'NS[A-Z].*Description|entitlements'

# Entitlements ファイルが変更されていないか確認
git diff HEAD~1 -- '*.entitlements'
```
