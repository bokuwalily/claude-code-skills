---
name: phaser-gameobject-property-conflict
description: PhaserのGameObject既存プロパティ（state, name, type等）と自作プロパティが衝突してTypeScriptエラーが出たとき
author: auto
created: 2026-05-29
version: 1.0.0
status: active
---

## Procedure

1. 型チェックを実行してエラー箇所を特定する
   ```bash
   npx tsc --noEmit 2>&1 | head -40
   ```

2. エラーメッセージで衝突プロパティ名を確認する
   - 例: `Property 'state' in type 'Bot' is not assignable to the same property in base type 'GameObject'`
   - Phaser の `GameObject` が持つ既存プロパティ: `state`, `name`, `type`, `data`, `active`, `visible`

3. 衝突しているプロパティを一括リネームする（例: `state` → `mode`）
   ```bash
   sed -i '' 's/this\.state/this.mode/g; s/private state: State/private mode: State/g' src/entities/Bot.ts
   ```
   複数ファイルにわたる場合:
   ```bash
   find src -name "*.ts" | xargs sed -i '' 's/\bstate: BotState\b/mode: BotState/g; s/this\.state\b/this.mode/g'
   ```

4. 再度型チェックして解消を確認する
   ```bash
   npx tsc --noEmit 2>&1 | head -20
   ```

## Pitfalls

- `sed` のパターンは厳密に書く。`this.state` を置換すると Phaser が内部で使う `.state` まで壊れる恐れがあるため、クラス内の `this.state` のみ対象にする
- `private state` の宣言行と `this.state` の参照行を別パターンで置換すること
- `name` は特に衝突しやすい。`Sprite` 等でも継承されているため `botName` のように prefix を付けるのが安全

## Verification

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
# → 0 であれば解消
```
