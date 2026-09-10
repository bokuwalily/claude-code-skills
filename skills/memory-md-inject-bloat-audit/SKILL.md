---
name: memory-md-inject-bloat-audit
description: inject_bytes が cc-self-audit 閾値（40KB）の75%超を超えた時に MEMORY.md が支配的な原因であることを診断し、不要エントリを刈り込む手順。2026-08-05に inject_bytes=34.9KB(87%閾値)・MEMORY.md=26KB(70%占率)を検出したパターンの再利用版。
author: auto
created: 2026-08-05
version: 1.0.0
status: active
---

## 背景

`cc-self-audit.sh` が週次で測定する `inject_bytes` は以下の合算:

```
inject_bytes = rules/*.md + ~/.claude/CLAUDE.md + ~/CLAUDE.md + MEMORY.md
```

MEMORY.md は会話を重ねるにつれて自動蓄積され、260ファイル超になると
単体で inject_bytes の 70%+ を占める（2026-08-05実測: 26.6KB / 34.9KB）。

閾値 `TH_INJECT_BYTES=40000`（40KB）を超えると cc-self-audit が RED 発動 → claude -p による自己修正スクリプトが起動される。

## トリガー条件

以下のいずれかで本スキルを参照する:

- `inject_bytes > 30000`（閾値の75%）
- `wc -c ~/.claude/projects/-Users-you/memory/MEMORY.md` > 20000
- cc-self-audit.log に `RED: inject_bytes` が出現

## Procedure

### 1. 現在値の診断

```bash
# inject_bytes の内訳を測定
echo "=== inject_bytes 内訳 ==="
echo "rules/*.md: $(find ~/.claude/rules -name '*.md' -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -c) bytes"
echo "~/.claude/CLAUDE.md: $(wc -c < ~/.claude/CLAUDE.md 2>/dev/null || echo 0) bytes"
echo "~/CLAUDE.md: $(wc -c < ~/CLAUDE.md 2>/dev/null || echo 0) bytes"
echo "MEMORY.md: $(wc -c < ~/.claude/projects/-Users-you/memory/MEMORY.md 2>/dev/null || echo 0) bytes"
echo "memory files: $(ls ~/.claude/projects/-Users-you/memory/*.md 2>/dev/null | wc -l) files"
echo "---"
TOTAL=$(( \
  $(find ~/.claude/rules -name '*.md' -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -c) + \
  $(wc -c < ~/.claude/CLAUDE.md 2>/dev/null || echo 0) + \
  $(wc -c < ~/CLAUDE.md 2>/dev/null || echo 0) + \
  $(wc -c < ~/.claude/projects/-Users-you/memory/MEMORY.md 2>/dev/null || echo 0) ))
echo "合計: $TOTAL bytes / 閾値 40000 ($(( TOTAL * 100 / 40000 ))%)"
```

### 2. MEMORY.md が主因の場合: 古い memory エントリ候補を特定

```bash
# 個別 memory ファイルをサイズ降順で表示（大きいものが刈り込み候補）
ls -lS ~/.claude/projects/-Users-you/memory/*.md 2>/dev/null | \
  grep -v "MEMORY.md" | tail -20 | awk '{print $5, $9}' | sort -rn | head -20

# project 種別 memory は project が終了していれば削除可
grep -l "type: project" ~/.claude/projects/-Users-you/memory/*.md 2>/dev/null | head -10
```

### 3. MEMORY.md index の刈り込み（手動 or claude -p 委譲）

刈り込み基準（いずれかに該当すれば削除候補）:
- **stale project**: 対象プロジェクトが終了・アーカイブ済み
- **code pattern**: コードのパターン・アーキは記憶でなくコードベースが正本
- **duplicate**: 同じ内容の feedback が別名で2件以上ある
- **resolved bug**: 修正済みバグの workaround メモ（コードに取り込まれた）
- **line 150+**: MEMORY.md は 200 行でトランケートされる → 150 行以内に保つ

```bash
# MEMORY.md の行数確認
wc -l ~/.claude/projects/-Users-you/memory/MEMORY.md

# 個別ファイルの削除（対応する MEMORY.md index 行も手動で削除）
# rm ~/.claude/projects/-Users-you/memory/stale_project_xxx.md
```

### 4. 削除後の検証

```bash
# inject_bytes 再計算
TOTAL=$(( \
  $(find ~/.claude/rules -name '*.md' -print0 2>/dev/null | xargs -0 cat 2>/dev/null | wc -c) + \
  $(wc -c < ~/.claude/CLAUDE.md 2>/dev/null || echo 0) + \
  $(wc -c < ~/CLAUDE.md 2>/dev/null || echo 0) + \
  $(wc -c < ~/.claude/projects/-Users-you/memory/MEMORY.md 2>/dev/null || echo 0) ))
echo "削減後: $TOTAL bytes / 40000 閾値"
[ "$TOTAL" -lt 30000 ] && echo "✓ 75%以下に収まった" || echo "⚠ まだ75%超"
```

## inject_bytes 成長トレンド（2026年実績）

| 日付 | inject_bytes | 対閾値 |
|------|-------------|--------|
| 2026-07-11 | 21,798 | 54% |
| 2026-07-19 | 23,855 | 60% |
| 2026-07-26 | 31,620 | 79% |
| 2026-07-31 | 32,299 | 81% |
| 2026-08-02 | 34,872 | 87% |

7月下旬のジャンプ（+7,765 in 7d）は memory 蓄積と CLAUDE.md 拡張が重なった時期と一致。

## Pitfalls

- **MEMORY.md だけ削っても index が残る** → 個別 `.md` ファイルと MEMORY.md index エントリを両方削除すること
- **feedback 記憶は慎重に** → 削除すると同じ過ちを繰り返す。stale でなければ残す
- **inject_bytes 計算式は自分の集計スクリプトが正本** → 週次バッチで自動計測しているなら、その `collect()` 相当の関数と定義を揃える（rules は再帰 find、MEMORY.md は固定パス、が上のProcedureの前提）
- **定期監査は週1程度が目安** → 削減効果は次回の定期実行まで確認できないことがある

## 関連スキル

- `claude-plugin-context-audit` — プラグイン/スキル側の bloat 診断（inject_bytes の内訳が違う）
- `pre-completion-self-audit` — 完了前の自己監査テンプレ
