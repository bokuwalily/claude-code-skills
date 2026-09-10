---
name: implementation-model-routing
description: コードの実装タスクを始めるときに必ず発火。Codex優先（閾値低め）・Sonnet委譲・Sonnet自実装の三段。週間制限が逼迫しているため、定型・修正・定期タスク調整は全てCodexへ先に投げる。
author: auto
created: 2026-06-21
version: 3.0.0
---

# 実装タスクのモデル自動振り分け（Codex優先・v3）

**運用方針（v3）＝Codex最優先。閾値を下げて小さい修正も全てCodexへ。**
週間制限逼迫のため「大規模・反復限定」の旧基準は廃止。1文で説明できるタスクは全部Codexへ投げる。Codexはトークンを食わない（ChatGPT Pro枠）。

## Procedure

0. **着手の最初のTodoで振り分けを宣言する（強制ゲート）**
   - `モデル振り分け: Codex委譲 / Sonnetサブエージェント / Sonnet自実装` のどれかを最初のtodo項目に入れる。
   - **デフォルトはCodex。** 「Codexに投げない理由」が言えない限りCodexへ。

1. **Codex行き（デフォルト・この条件なら問答無用でCodex）**:
   - 定期タスク修正（launchd/cron/plist/自動化スクリプト）
   - 既存スクリプト・コードの修正・バグ修正（原因確定済み）
   - 設定ファイル変更・追記・追加
   - 小さい機能追加（「〜を追加して」「〜を変えて」）
   - テスト生成・リファクタ・型合わせ・import整理
   - 既存パターンの横展開・別言語/別FWへの移植
   - CRUD・ボイラープレート・雛形生成
   - 単純なバグ修正（原因と直し方が確定しているもの）
   - 「ちょっと直して」系は全部Codex（小ささは免罪符にならない）

   **Codex呼び出し（空振り防止テンプレ）**:
   ```bash
   timeout 600 codex exec --skip-git-repo-check \
     --output-last-message /tmp/codex-out.txt \
     "作業dir: /abs/path / 対象: @/abs/file.py @/abs/file2.sh / やること: <具体的に> / 完了条件: <機械検証可能> / 検証: <コマンド>" </dev/null
   ```
   投げ後必須: `git diff --stat && ls -la <期待ファイル>` で実変更を確認。詳細→

2. **Sonnetサブエージェント行き（Codex不向きと判明してから）**:
   - 複数ファイル跨り・文脈往復が3回以上要る
   - Codex 2回空振り後のフォールバック
   - 対象ファイルが散在して@file列挙が現実的でない
   → `Agent(model:"sonnet")` で同セッション文脈を引き継げる

3. **Sonnet自実装（本当に設計判断が要る時だけ・最後の手段）**:
   - アーキテクチャ・モジュール境界・データモデル設計
   - 並行性・非同期・状態設計
   - API契約・エラー設計・後方互換の解釈
   - 仕様が曖昧で意図の補完が要るもの
   - セキュリティ・認可・課金・マイグレーション

4. **委譲後レビューはSonnetで素早く行う**:
   - `git diff --stat` でファイル変更確認
   - 差分を読んで設計・契約・セキュリティだけ確認
   - 行単位の粗探しは不要（Codexに任せる）

## 発火の実体

フック `~/.claude/hooks/model_routing_reminder.sh`（UserPromptSubmit登録）で強制発火。
auto/配下スキルはSkillツールフラット走査に載らないため、フック注入で代替している。

## Pitfalls

- **「小さいからSonnetで直接書く」が最大の失敗。** 小さいほどCodexが向く（指示1文で済む）。
- **Codexが空振りしても2回まで試す。** 投げ方（@file/作業dir/完了条件）を直してリトライ。
- **委譲しないまま自分で書き始めたら途中でも手を止めてCodexに投げ直す。**

## Verification

- Codexへの委譲が `git diff --stat` で実変更として現れているか
- 空振りが続くなら @file 漏れ・作業dir不一致・timeout不足を確認
