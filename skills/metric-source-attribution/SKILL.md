---
name: metric-source-attribution
description: 自動スクリプトが数値・率・件数を出力する際、必ず「何を数えたか」のソース/分母ラベルをセットで出力するパターン。hot.md 2026-08-22 主題「数字は立っているが何のものか誰も言えない」から抽出。取得率/成功件数/フォロバ率など全種類に適用。
author: auto
created: 2026-08-24
version: 1.0.0
tags: [metrics, attribution, output, automation, reporting]
related: [pending-accumulation-guard, output-metric-attribution, conv-log-project-batch-upsert]
---

## 問題

自動スクリプトが数値・率を出力する際に「何を分母にしたか」「どのデータソースから計算したか」を省略すると、その数値は後続作業で参照できない。

### 実例（hot.md 2026-08-22 窓から）

| 出力値 | 問題 |
|--------|------|
| 取得率 100% | 何を取得したのか不明。対象リストが空だった可能性 |
| 相場 0円 | どの API / テーブルから取得したか不明。ソースが 0件返却 |
| 成功 6件 | 全何件中の 6件か不明。エラー0件と区別できない |
| フォロバ率 1.0% | 分母がフォロワー全体か直近フォローか不明 |
| 学習サンプル N件 | どのフィルタを通過したデータか不明 |

全て「数値は正しく計算されている」が「何のための数値か言えない」状態。

## パターン

### NG（数値のみ）

```python
print(f"成功: {success_count}件")
print(f"取得率: {rate:.1%}")
```

### OK（ソース・分母をセット）

```python
print(f"成功: {success_count}件 / 全{total_count}件 (source: {table_name})")
print(f"取得率: {rate:.1%} (分母: candidates={len(candidates)}, フィルタ: {filter_desc})")
```

### OK（構造化出力）

```python
result = {
    "success": success_count,
    "total": total_count,
    "source": "orders WHERE status='complete' AND date=today",
    "rate": success_count / total_count if total_count else None,
    "rate_denominator": "total発注件数",
}
print(json.dumps(result, ensure_ascii=False))
```

## チェックリスト

スクリプトを書いたら以下を確認する:

- [ ] `count` / `件数` を出力 → 分母（`total` / `全N件`）が隣にある
- [ ] `rate` / `率` / `%` を出力 → 分母の定義文字列（例: "直近フォローアカウント"）が付く
- [ ] 外部 API から価格・数量を取得 → どの endpoint/table かが出力に含まれる
- [ ] フィルタを通した件数 → フィルタ条件の要約が付く
- [ ] 「0件」「0円」など zero を出力 → ソースが返した件数も付ける（空リスト vs APIエラーを区別）

## 実装パターン集

### ラッパー関数（Python）

```python
def report(label: str, value, total=None, source: str = ""):
    """常にソース付きで出力する。"""
    parts = [f"{label}: {value}"]
    if total is not None:
        parts.append(f"/ 全{total}")
    if source:
        parts.append(f"(source: {source})")
    print(" ".join(parts))

# 使用例
report("成功", success, total=len(orders), source="orders table")
report("フォロバ率", f"{rate:.1%}", total=followed_count, source="follower_events last 7d")
```

### ログ形式（bash）

```bash
log_metric() {
    local label="$1" value="$2" total="$3" source="$4"
    echo "[METRIC] ${label}: ${value} / ${total:-?} (src: ${source:-unknown})"
}

log_metric "success" "$success_count" "$total_count" "DB orders table"
log_metric "price" "${price}円" "market API" "Yahoo Finance endpoint"
```

## Pitfalls

1. **0件・0円を「成功」と誤認**: ソースが空リストを返した場合も取得率100%になる。`len(source_list)` も出力して区別する。
2. **`total=0` 除算エラー**: rate 計算前に `if total == 0: return None` して出力に `"(分母=0, 計算不可)"` を付ける。
3. **分母の定義ズレ**: 「フォロバ率」の分母が実装者によって「全フォロワー」と「直近フォロー」で異なる。定義を文字列で出力に埋める。
4. **外部ソース変更を見逃す**: API endpoint が変わって 0件返却でもエラーにならない場合がある。`source_count` を常にログに出す。
5. **ログレベルが高すぎて埋もれる**: metric 出力は `INFO` ではなく専用プレフィックス `[METRIC]` を使い grep できるようにする。

## Verification

```bash
# スクリプト内の数値出力に source/分母が付いているか確認
grep -n "print\|echo\|log" your_script.py | grep -v "source\|total\|分母\|src" | grep -E "[0-9]件|[0-9]%|rate|count"
# → 残ったものが attribution 欠けの候補
```
