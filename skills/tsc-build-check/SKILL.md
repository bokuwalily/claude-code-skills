---
name: tsc-build-check
description: TypeScript/Next.js プロジェクトで commit/push 前に行う型チェック→ビルド検証の標準パターン。発火: TS プロジェクトで `tsc --noEmit` `npm run build` 連続呼び出し時、CI失敗時、本番デプロイ前のローカル verify
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Write
---

## Procedure

1. `npx tsc --noEmit 2>&1 | head -40` で型エラー先頭40行を取得
2. exit code チェック: `$? = 0` ならビルドへ進む（非ゼロなら型エラーを修正して再実行）
3. `npm run build 2>&1 | tail -30` で末尾30行を取得
4. exit 0 確認、warning が >0 ならログ全文を確認
5. `git diff --cached` で staged 差分の最終 review

## Pitfalls

- `npx tsc` のキャッシュが古いと false positive が発生 → `rm -rf .next node_modules/.cache` で clean run
- Next.js は `npm run build` で型エラーを catch することがあり、`tsc` 単体では検出しない型もある（next/image 型など）
- `--incremental` 利用時は `.tsbuildinfo` が >200KB になると逆効果（post_tsc_check.sh の adaptive 戦略を参照）
- `tail -30` で見切れる場合は `tail -100` に拡張、または `2>&1 | tee build.log` で全文保存

## Verification

- 検出: ログに `found 0 error` / `Compiled successfully` が含まれる
- 比較: 前回 commit ハッシュとの diff で regression（増えたエラー）なし
- exit code: `tsc` と `build` 両方が 0
- `npx tsc --noEmit; echo "tsc=$?"; npm run build; echo "build=$?"` の連結で両方の終了コードを 1 行で確認可能
