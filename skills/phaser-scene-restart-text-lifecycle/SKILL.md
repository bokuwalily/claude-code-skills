---
name: phaser-scene-restart-text-lifecycle
description: Phaser3 で scene.restart 後に dangling Text reference や delayedCall 不発火が起こる問題を、setTimeout フォールバック + null チェックで回避するパターン。発火: scene 再起動後の "Cannot read property of undefined" エラー / 黒画面停止 / delayedCall タイマー発火しない時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Edit
---

## Procedure
1. `scene.restart()` 呼ぶ前に scene.events.once('shutdown', ...) で残オブジェクトを destroy
2. 各 Text/Image reference は restart 後に再生成必須 → コンストラクタで再初期化
3. delayedCall は `scene.time.delayedCall(...)` でなく `setTimeout` 経由でフォールバック (restart 後の時間管理リセット対策)
4. transition 系の長時間タイマーは scene 終了時に手動 clearTimeout
5. tween は scene.tweens.killAll() で確実停止

## Pitfalls
- `scene.restart()` は事実上 scene 全破棄 → 既存 reference は全て null
- `scene.time.delayedCall` が稀に発火しない → setTimeout に fallback
- transition 中の `scene.add.text(...)` は黒画面で見えない → 先に scene.transitioning フラグ確認
- 並列セッションがゲームを編集中の場合、HMR と restart で reference 競合

## Verification
- `Cannot read property of undefined` / `null is not an object` エラーがコンソールに出ないこと
- ブラウザコンソールで `phaser.scene.scenes.filter(s => s.scene.isActive())` で 1 scene のみ active
- 黒画面停止が再現しないことを 5 回 restart で確認
