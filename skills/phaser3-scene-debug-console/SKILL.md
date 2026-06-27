---
name: phaser3-scene-debug-console
description: Phaser3ゲームのシーンをwindowに公開し、ブラウザコンソールから決定論的にゲームロジックをテストしたいとき
author: auto
created: 2026-05-29
version: 1.0.0
status: active
---

## Procedure

1. GameScene の `create()` または適当な初期化箇所に1行追加してシーンを公開する
   ```ts
   // GameScene.ts の create() 末尾
   (window as any).scene = this;
   ```

2. devサーバーを起動する（HMRが有効なので保存後に自動反映）
   ```bash
   npm run dev
   ```

3. ブラウザのコンソールで任意のゲームロジックを呼び出して検証する
   ```js
   // スライムのHP・ダメージ・討伐カウントを確認
   const slimes = window.scene.slimes;
   console.log('alive slimes:', slimes.filter(s => s.hp > 0).length);
   
   // プレイヤーが特定のモンスターを攻撃
   const target = slimes[0];
   window.scene.player.attack(target);
   console.log('slime hp after hit:', target.hp);
   
   // XP・レベルアップを強制検証
   window.scene.player.gainXP(999);
   console.log('level:', window.scene.player.level);
   ```

4. 検証が完了したら本番ビルドでは window 公開行を削除する
   ```bash
   grep -rn "window as any" src/
   ```

## Pitfalls

- `(window as any)` はTypeScriptの型チェックを回避するため、本番コードに残さないこと
- HMRが効いているので変更後はページリロード不要だが、シーンの再初期化が走る場合はゲーム状態がリセットされることがある
- ブラウザの `devtools` で console を開いたまま操作すると、キーイベントがゲームに届かないことがある（`focus()` を確認）

## Verification

```js
// コンソールで動作確認
typeof window.scene !== 'undefined'  // → true であれば公開成功
window.scene.constructor.name        // → "GameScene" 等のクラス名が返る
```
