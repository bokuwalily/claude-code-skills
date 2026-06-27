---
name: wp-http-article-audit
description: WordPressサイトのURLリストを並列HTTPで一括取得し、記事上部エリア（article～最初のh2間）の特定CTAの設置状況を分類・CSV出力するときに使う
author: auto
created: 2026-05-28
version: 1.1.0
status: active
disallowed-tools: Agent Edit
disable-model-invocation: true
---

## Procedure

1. **対象URLリストを取得**
   - Excelや管理画面から対象記事のURLを収集しCSVに保存
   - WP-CLIが使えるなら: `wp post list --post_type=post --posts_per_page=-1 --fields=ID,post_name,guid`

2. **判定ロジックの設計**
   - NG: ページ全体に検索ドメインが存在するかだけでは不正確（フッター・サイドバーで誤検知）
   - OK: `<article>` タグ開始〜最初の `<h2>` タグまでの範囲に絞って判定する

3. **並列HTTPチェックスクリプト（Python例）**

```python
import asyncio, aiohttp, csv
from bs4 import BeautifulSoup

TARGET_DOMAIN = "lp.example.co.jp"
OTHER_DOMAIN  = "realme.jp"

async def check(session, url):
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            html = await r.text()
    except Exception as e:
        return url, "ERROR", str(e)

    soup = BeautifulSoup(html, "html.parser")
    article = soup.find("article")
    if not article:
        return url, "NO_ARTICLE", ""

    # article 先頭〜最初の h2 までを切り出す
    segment = ""
    for tag in article.children:
        if getattr(tag, "name", None) == "h2":
            break
        segment += str(tag)

    if TARGET_DOMAIN in segment:
        status = "TARGET"
    elif OTHER_DOMAIN in segment:
        status = "OTHER_CTA"
    elif segment.strip():
        status = "NO_CTA"
    else:
        status = "EMPTY"
    return url, status, ""

async def main(urls):
    async with aiohttp.ClientSession() as session:
        tasks = [check(session, u) for u in urls]
        return await asyncio.gather(*tasks)

urls = [row[0] for row in csv.reader(open("target_urls.csv"))]
results = asyncio.run(main(urls))

with open("audit_result.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["url", "status", "note"])
    w.writerows(results)
```

4. **結果の絞り込み**
   - `status != "TARGET"` の行が対応必要記事
   - OTHER_CTA（他社CTAあり）と NO_CTA（なし）を別々に集計して優先度をつける

## Pitfalls

- **フッター誤検知**: ページ全体でドメイン検索すると、フッターやサイドバーのリンクも拾う。必ず記事上部エリアに限定する
- **article タグなし**: LP や固定ページは `<article>` がない場合がある。フォールバック（main タグ等）を追加するか除外する
- **レート制限**: 並列数を多くしすぎると503返す。`asyncio.Semaphore(20)` 等で同時接続数を制限する
- **エンコーディング**: 日本語サイトは `r.text()` だと文字化けする場合あり。`await r.read()` して `html.decode("utf-8", errors="replace")` に切替える

## Verification

```bash
# 出力CSVで件数確認
python3 -c "
import csv; rows=list(csv.DictReader(open('audit_result.csv')))
from collections import Counter; print(Counter(r['status'] for r in rows))
"
# → Counter({'TARGET': 215, 'OTHER_CTA': 517, 'NO_CTA': 86, ...}) のように分類されればOK
```
