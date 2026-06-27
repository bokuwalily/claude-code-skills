---
name: ios-permission-key-security-matrix
description: iOSアプリのproject.yml / Info.plistの差分をセキュリティレビューするとき、各 NSXxx キーが「追加専用」か「フル読み書き」かを判定する。XcodeGen project.yml の変更レビュー時に発火する。
author: auto
created: 2026-06-24
version: 1.0.0
status: active
---

## Procedure

### 1. 差分の分類

project.yml / Info.plist の変更を以下の4カテゴリに分類する。

| カテゴリ | 内容 | セキュリティ影響 |
|---|---|---|
| ビルド番号 | `CURRENT_PROJECT_VERSION`, `MARKETING_VERSION` | なし |
| 使用説明文字列 | `NSXxxUsageDescription` 系 | 権限の**種類**に依存（下表参照） |
| CI/IaC変更 | `scripts`, `preBuildScripts`, `postBuildScripts` | 要チェック |
| コード変更 | `.swift`, `.m` ファイル参照 | 別途コードレビュー |

### 2. Photosライブラリ権限の区別（非自明）

```
NSPhotoLibraryAddUsageDescription  →  追加専用（write-only）
NSPhotoLibraryUsageDescription     →  フル読み書き（read+write）
```

- **Add専用**は写真を保存するだけ（シェアカード保存など）で、ユーザーのアルバムを読み取れない
- **フル読み書き**はユーザーの全写真にアクセスできるため影響が大きい
- セキュリティ観点では Add専用のほうが常に狭い権限 → 必要最小権限の原則に沿っている

### 3. よく使う権限キー一覧

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

### 4. レビュー手順

```
1. diff を読み、「何が増えたか」を4カテゴリに分類
2. 権限キーが追加された場合:
   a. 上表でアクセス範囲を確認
   b. 使用説明文字列が静的か動的（文字列補間あり）か確認
   c. 実際に使う用途と権限の範囲が一致するか確認
3. scripts / build phases の変更があれば別途コマンド注入を確認
4. コード変更がなく権限のみなら "code paths not affected" と明示して報告
```

## Pitfalls

- `NSPhotoLibraryAddUsageDescription` と `NSPhotoLibraryUsageDescription` を混同しやすい。前者はApple必須（なければクラッシュ）で追加専用、後者がフルアクセス。
- 使用説明文字列に `\(variable)` などの文字列補間が入っていると XSS 的ではないが内容注入リスクがある（稀）。
- ビルド番号バンプだけの差分は "no findings" で即結論出してよい。調査深堀り不要。
- Info.plistの `ITSAppUsesNonExemptEncryption: false` はApp Store向けの輸出コンプライアンス申告。セキュリティ上は問題ない（暗号化を使わないという申告）。

## Verification

- `NSPhotoLibraryAddUsageDescription` のみ追加 → findings なし（追加専用・狭い権限）
- `NSPhotoLibraryUsageDescription` 追加 → findings あり（フルアクセス・用途の妥当性確認が必要）
- ビルド番号のみ変更 → findings なし（即回答可能）
- build scripts 追加 → コマンド内容を必ず確認してから判定
