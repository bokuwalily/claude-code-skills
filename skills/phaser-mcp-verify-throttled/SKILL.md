---
name: phaser-mcp-verify-throttled
description: ブラウザMCP(claude-in-chrome等)でPhaser3ゲームを自動検証する際、対象タブが非フォアグラウンドでRAFスロットリングされゲームループが止まり、delayedCall/シーン遷移が発火しない/待っても進まないとき
author: auto
created: 2026-06-01
version: 1.0.0
---

## Procedure

MCP(headless)でPhaserゲームを driveすると対象タブはOSフォアグラウンドにないため、
ChromeがRAFを激しく throttle し `game.loop` がほぼ停止する。結果：
- `scene.time.delayedCall(...)` が発火しない（遷移コールバックが永遠に保留）
- カメラfadeが途中(progress 0.2等)で止まる
- 実時間 `wait` をいくら挟んでもゲーム内時間が進まない

**対策：ゲームループを手動でポンプして決定論的に時間を進める。**

0. **前提準備（旧 phaser3-scene-debug-console から吸収）**: シーンとゲーム本体を dev handle で公開する。
   ```ts
   // GameScene.ts の create() 末尾（DEV限定で）
   (window as any).scene = this;
   ```
   コンソールで `typeof window.scene !== 'undefined'` → true、`window.scene.constructor.name` → クラス名で公開成功を確認。
   これで `window.scene.player.attack(target)` / `gainXP(999)` 等のロジック直呼び検証ができる。
   本番ビルド前に `grep -rn "window as any" src/` で公開行を削除すること。
   注意: devtools の console にフォーカスがあるとキーイベントがゲームに届かない（`focus()` を確認）。

1. dev handle でゲーム本体を公開しておく（`window.__game = game` 等、`import.meta.env.DEV`内）

2. 状態遷移やタイマーを進めたいときは `game.loop.step()` を実時間タイムスタンプを
   進めながら複数回呼ぶ。1フレーム≒16msで、遷移＋create＋fadeなら 100〜160回が目安：
   ```js
   const g = window.__game;
   let t = performance.now();
   for (let i = 0; i < 160; i++) { t += 16; g.loop.step(t); }
   ```
   これで保留中の delayedCall が発火し、`scene.start()` のキュー処理・create・fadeまで進む。

3. シーンの「本当の」状態は `isActive()` ではなく `sys.settings.status` を読む。
   遷移中の `game.scene.isActive(key)` は古い値を返して描画と食い違う：
   ```js
   const P = Phaser.Scenes;
   const cn = c => Object.keys(P).find(k => P[k] === c) || c; // 'RUNNING'/'SHUTDOWN'/'INIT'
   game.scene.scenes.map(s => ({ key: s.scene.key, status: cn(s.sys.settings.status) }));
   const uiUp = game.scene.getScene('ui').sys.settings.status === P.RUNNING;
   ```

4. document レベルのキーハンドラ（`document.addEventListener('keydown', ...)`）は
   合成イベントでテストできる。発火後にループをポンプして反映を確認：
   ```js
   document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true }));
   for (let i = 0; i < 20; i++) { t += 16; g.loop.step(t); }
   ```

5. 画面の見た目は MCP screenshot で確認（canvasは最後にstepした内容を描画している）。
   ステップ→screenshot の順でバッチ実行すると最新状態が映る。

## Pitfalls

- セーブを書き換えて検証する場合は **先に localStorage をバックアップし、検証後に復元**する
  （`window.__BK = {key, val}` に退避 → 末尾で `localStorage.setItem` + `PS.load()` で戻す）。
- `game.loop.step()` はRAFと二重に走り得るが、検証用途では許容。終わったらリロードでクリーン化。
- 実プレイ確認は「クラッシュしない」だけでなく、遷移後に期待UI(HUD等)が `RUNNING` かつ
  screenshotで視認できることまで見る（スモークテストで終わらせない）。
- 手動コンソール用の scene 公開の基本形は Procedure 0 参照（旧 phaser3-scene-debug-console を吸収済み）。

## Verification

```js
// ポンプが効いているか：stepを回す前後で scene.time.now が増える
const g = window.__game, before = g.scene.getScene('game').time.now;
let t = performance.now(); for (let i=0;i<60;i++){ t+=16; g.loop.step(t); }
g.scene.getScene('game').time.now > before;  // → true ならループが進んでいる
```
