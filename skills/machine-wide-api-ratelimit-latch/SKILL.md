---
name: machine-wide-api-ratelimit-latch
description: 同一マシン/同一IPで多数の launchd ジョブが同じ外部 private API を叩き、1本が 429 を見ても他が撃ち続けてスロットルを自分で延命する構造を、blockedUntil を1ファイルで共有するラッチで止める手順（social-autolike の state/ig-api-ratelimit.json が実例）。
author: auto
created: 2026-09-04
version: 1.0.0
tags: [automation, rate-limit, 429, state-management, social-autolike, instagram, launchd]
source: 2026-09-04 autopilot タスク「IG private API 429 のマシン共有ラッチ」（commit e4b34b0）
---

## 症状
- `logs/*.log` の API 失敗行（例 `igApiFail`）が 1日数百件・全部 status 429、bodyHead は「ログイン済み HTML の殻」＝Cookie は生きている
- 既存の防御が **プロセス内変数の streak** かレーン別 state で、run のたびにゼロから撃ち直す
- 複数アカウントが同じ日に順次 429（同一IP でまとめて絞られている）

## 手順（実装30分・6ファイル程度）
1. `src/<api>-ratelimit.js` を新規: `{blockedUntil, openedAt, lastStatus, lastUrl, source, hits, lastNotifyAt}` を tmp→rename で原子的に読み書き。export は `isXCooldownActive(now)` / `openXCooldown({source,status,url}, now)`（初回90分・窓内再検知で残り×1.5・上限6h）/ `describeXCooldown()`（既存の『rate-limit cooldown中 -> ISO まで…』文言に揃える）/ `xRateLimitError()`（`e.code='<api>-rate-limit'`）。**state パスは env で差し替え可**にし、呼び出し時に env を読む（ESM の import hoist 対策）。
2. 低レベルの HTTP 経路すべて（page.evaluate 版と request.get 版の両方）で「先頭で active なら撃たない」「429 を見たら open」。`res.status()` を必ず見る（本文が JSON でないだけの判定は 429 を取りこぼす）。
3. 各エントリポイントは **Chrome 起動前**に gate → exit 0（launchd を赤にしない）。致命エラー catch で `e.code` を見て exit 0 に分岐。Discord は `lastNotifyAt` で24hに1回。
4. **テストの落とし穴**: 429 をモックする既存テストが本番 state へ書き 90 分本番を止める。既存テストの先頭でも env を tmp へ向け、`node --test` 後に `ls state/<file>` で「存在しない」ことを確認する。`test/index.js` に import 登録しないと `node --test test/` に拾われない。
5. 検証は `launchctl kickstart -k` → `last exit code = 0` と新規ログ行の grep（完了 or cooldown中）で実測。

## 関連
- （窓が長すぎて陳腐化する逆パターン。上限6h と期限切れ後の再オープンで両立）
