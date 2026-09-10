---
name: visual-self-verify-agent-loop
description: Delegate visual work (3D/WebGL/UI polish) to a subagent that builds, screenshots, and views its own renders in a loop until explicit acceptance criteria pass. Use when word-based tuning feedback to an agent fails twice, or whenever delegating aesthetics-critical implementation that cannot be judged by tests alone.
---

## When

- サブエージェントに見た目調整（three.js・アニメーション・レイアウト）を委譲し、言葉の数値指示で2回直らなかったら即このループへ切り替える
- 最初からビジュアル品質が主目的の委譲でも使ってよい（往復1〜2回分速い）

## Procedure

1. 親がスクショスクリプトを先に整備して scratchpad に置く（Playwright・スクロール連動ページは wheel でなく scroll コンテナの scrollTo を進捗率指定で叩く。`document.querySelector('main').scrollTo({top: (scrollHeight-clientHeight)*frac})`）
2. サブエージェント（Sonnet general-purpose）に次の完結ループを渡す: build → サーバ再起動 → スクリプト実行 → 生成PNGを**Readで実際に見る** → 合格基準と照合 → 修正 → 繰り返し。上限周回数を明示（5周程度）
3. 合格基準は「現象ベース」で書く（例:「四角い粒が1つも見えない」「巨大なボケ球が横切らない」「泥色に見えない」）。数値指定より現象指定のほうが収束が速い
4. 迷った時の判定基準を1行与える（例:「ポートフォリオで金を取れる見た目か」）
5. 完了報告後、**親が必ず独立に再スクショして最終目視**（エージェントの自己判定は甘くなりがち）

## Pitfalls

- エージェントは自分のレンダーを見ない限り盲目でチューニングする。数値往復は2回で見切る
- pageerror/コンソールも同じスクリプトで拾わせる（視覚OKでもJSエラーが残る）
- CSS側の構造問題（不透明背景が canvas を覆う等）はシーン側では直らない。エージェントに「シーン外が原因と判明したら報告せよ」と逃げ道を与えると z-index 実験などで特定してくる
- deviceScaleFactor: 2 で撮らせると微細なアーティファクト（四角ポイント等）を見逃さない

## Verification

親側で: 再ビルド → 全区間スクショ → 自分の目視 → バンドルサイズ退行チェック → デプロイ → ライブ実写1枚。
