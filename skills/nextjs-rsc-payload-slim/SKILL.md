---
name: nextjs-rsc-payload-slim
description: Next.js App RouterのページHTMLが異常に重い（数百KB）/ LCPが遅い時に発火。DBのselect('*')がclient componentに渡りRSC flightペイロードに全文が直列化されるパターンの診断と修正手順
author: auto
created: 2026-06-12
version: 1.0.0
---

# Next.js RSCペイロード肥大の診断と修正

## Procedure

1. **計測**: `curl -s -o /tmp/page.html -w "%{size_download}" <URL>`（生サイズ）と `-H "Accept-Encoding: gzip"`（転送サイズ）。`grep -o 'self.__next_f.push' /tmp/page.html | wc -l` でflightチャンク数を見る。HTML数百KB＋チャンク多数なら本パターン濃厚。
2. **犯人特定**: ページのサーバーコンポーネントから client component（'use client'）に渡している props を追う。DB層（Supabase/Prisma/Drizzle）で `select('*')` が長文カラム（content/body/description等）込みで返していないか grep。**client componentに渡したオブジェクトは全フィールドがflightに直列化される**（サーバーで使わなくても）。
3. **修正**: 一覧・カード表示用の軽量型を定義（例 `ArticleListItem = Omit<Article,'content'>` + 派生値）。長文から計算する派生値（読了時間等）はサーバー側で事前計算してフィールド化（`reading_min: Math.ceil(content.length/400)`）。DB→サーバー間は select('*') のままでも害は小さい（問題はHTML/flightに乗ること）。全コール経路（一覧API・likes API等のJSONレスポンス含む）を同じ型に統一。
4. **検証**: 本番ビルド（`next build && next start`）でcurl再計測。devサーバーはHMRペイロードが乗るので比較に使わない。

## Pitfalls

- カード側が `article.content.length` 等で長文を1箇所だけ参照していると型エラーで発覚する。削るのではなく事前計算フィールドに置換（UX維持）。
- `select('*')` が複数関数にコピペ増殖している（getArticles/getArticlesByTag/likes API…）。1関数直して満足しない。全経路をgrepすること。
- ISR（revalidate）ページはデプロイ直後にキャッシュが切り替わるので、計測は新デプロイ確認後に。
- ついでに直すと良い同根バグ: 一覧orderがslug文字列昇順（1,10,100…）になっている「新着」表示、published フィルタ漏れ。

## Verification

- 実例: 就活ナビ（seo-affiliate-site）トップ 493KB→189KB（-62%）。commit 66de8f5（2026-06-12）。
- 成功判定: 生HTMLが数十〜200KB台、flight内に長文カラムの中身が無い（`grep "本文の冒頭数語" /tmp/page.html` がヒットしない）。
