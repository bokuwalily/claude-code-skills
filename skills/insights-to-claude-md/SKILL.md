---
name: insights-to-claude-md
description: /insights レポートの摩擦分析から CLAUDE.md を系統的に改善するとき。発火は (1) ユーザーが /insights を実行してレポートが出た直後 (2) 同種の失敗・修正指示が2回以上繰り返されたと気づいた時 (3) 月次の CLAUDE.md 見直し時。前提として /insights レポート（またはそれに準ずる摩擦一覧）が手元にあること。
author: auto
created: 2026-06-09
version: 1.0.0
status: active
---

## Procedure

1. `/insights` を実行してレポートを取得する
2. `friction_analysis.categories` を列挙し、各摩擦カテゴリを特定する
3. `suggestions.claude_md_additions` の各 `addition` を確認する
4. 追加先のセクションが CLAUDE.md に存在するか確認する
   - 存在しない → 新規セクション `## <Section Name>` を追加
   - 存在する → 既存セクションに追記
5. 各 addition を対応するセクションに箇条書きで挿入する
6. よく使われる追加パターン（過去事例から）:
   - `## API & Cost Constraints` — 無料 API のみ使用、有料 API は明示承認が必要
   - `## Self-Verification` — 自律ビルド後の出力確認をレポート前に必須化
   - `## Following Specs` — 渡されたファイル・リストを正確に従う（全件処理禁止）
   - `## Security & Publishing` — push 前の PII/APIキー スキャンとリモート確認
   - `## Deployment` — push してからデプロイ確認を完了報告の条件にする

## Pitfalls

- 既存ルールと矛盾する追加は禁止。追加前に既存 CLAUDE.md を全文確認する
- セクションを細かく分けすぎない。関連ルールは同セクションにまとめる
- `suggestions.features_to_try` は CLAUDE.md に書かず、別途 hooks や settings.json で実装する
- 個人情報・財務情報など会話内の個人データはルール化しない

## Verification

- `grep "## " ~/.claude/CLAUDE.md` で追加したセクションが存在するか確認
- 摩擦カテゴリの数と追加セクション数が概ね対応していることを確認
- 追加後に Claude Code を再起動して新ルールが読み込まれるか確認（`/config` で確認）
