---
name: excel-filtered-url-http-audit
description: スプレッドシート（Excel/CSV）から条件列でURLを絞り込み、並列HTTP取得でDOM内の特定要素の有無を判定し、結果をCSVに分類出力する。コンテンツ監査・CTA設置確認・SEOチェックなどに繰り返し使える。
author: auto
created: 2026-06-03
version: 1.0.0
status: active
---

## Procedure

1. **Excelからターゲット URL を抽出**

```python
import openpyxl, csv, re, requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

wb = openpyxl.load_workbook("input.xlsx")
ws = wb.active

# ヘッダー行からカラムインデックスを特定
headers = [cell.value for cell in ws[1]]
url_col   = headers.index("URL") + 1          # 実際の列名に置換
filter_col = headers.index("推奨CTA") + 1     # 絞り込み列

target_urls = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[filter_col - 1] == "ABABA":        # 絞り込み条件
        url = row[url_col - 1]
        if url:
            target_urls.append(url)
```

2. **並列 HTTP 取得 + DOM 判定**

```python
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; AuditBot/1.0)"}
TIMEOUT  = 10

def check_url(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        soup = BeautifulSoup(r.text, "html.parser")

        # 判定対象セクションを絞る（例: <article> ～ 最初の <h2> の間）
        article = soup.find("article")
        if article:
            h2 = article.find("h2")
            section_html = str(article)[:str(article).find(str(h2))] if h2 else str(article)
        else:
            section_html = r.text[:3000]

        # CTA 種別を判定（優先順位付き）
        if "target-service-a.co.jp" in section_html:
            cta_type = "TARGET_A"
        elif "other-service.jp" in section_html:
            cta_type = "OTHER"
        else:
            cta_type = "NONE"

        return {"url": url, "cta": cta_type, "status": r.status_code, "error": ""}
    except Exception as e:
        return {"url": url, "cta": "ERROR", "status": 0, "error": str(e)}

results = []
with ThreadPoolExecutor(max_workers=10) as ex:
    futures = {ex.submit(check_url, u): u for u in target_urls}
    for f in as_completed(futures):
        results.append(f.result())
```

3. **CSV に分類出力**

```python
with open("audit_result.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["url", "cta", "status", "error"])
    writer.writeheader()
    writer.writerows(results)

# サマリー表示
from collections import Counter
print(Counter(r["cta"] for r in results))
```

## Pitfalls

- **Excel 列名の確認必須**: `headers.index()` は完全一致なのでスペース・全角ズレで KeyError になる。先に `print(headers)` で確認する
- **ページ全体でなくセクション限定で判定**: フッターや別箇所にもターゲット文字列が出現することがあるため、判定は `<article>` ～ 最初の `<h2>` などのスコープに限定する
- **User-Agent を設定**: デフォルト requests は弾かれやすい。本番サイトには現実的な UA を付ける
- **最大ワーカー数**: `max_workers=10` が安全な上限目安。サイトへの負荷・レート制限に注意
- **エンコーディング**: 日本語 Excel を扱う場合は CSV 出力を `utf-8-sig`（BOM付き）にしないと Excel で文字化けする
- **Excelが `.xlsx` ではなく `.xls`**: openpyxl は `.xls` 非対応。xlrd を使うか事前に変換

## Verification

- 結果 CSV の `NONE` サンプルをブラウザで数件手動確認し、実際に対象要素がないことを目視検証
- `TARGET_A` 判定サンプルも同様に確認して誤検知がないかチェック
- `status` 列が 0 または 404 の行はURLミスや削除済みの可能性があるため個別対応
- `Counter` サマリーの合計件数がインプット URL 数と一致することを確認
