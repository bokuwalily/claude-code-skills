---
name: automation-stale-cooldown-flag
description: 自動化スクリプトが自己設定したcooldownフラグが陳腐化し、プラットフォーム制限が終わっても実行をスキップし続ける「自己ブロック」パターンの診断と修正手順。
author: auto
created: 2026-07-31
version: 1.0.0
tags: [automation, debugging, cooldown, state-management, social-autolike]
source: hot.md 2026-07-31 / projects/social-autolike Codex会話ログ分析
---

## 症状（この状況に当てはまったら本スキルを参照）

- automation jobは定期実行されているが処理件数が**継続的に0件**
- ログに「cooldown中」「waiting until YYYY-MM-DD HH:MM」と出る
- 手動で同じ操作をすると**成功する**（プラットフォーム制限ではない）
- 「X側の制限」「API上限」と誤診されがち

## 根本パターン（2026-07-22 social-autolike 事例）

```
[検知失敗] follow操作が成功したのに、automation側が成功を検知できず
    ↓
[5連続"失敗"] 連続失敗カウントが閾値超え → 24時間cooldownをstateに保存
    ↓
[フラグ永続化] cooldown期限が切れてもstateは上書きされない
    ↓
[毎時スキップ] jobは起動するが「cooldown期限内」と判定 → 翌日まで0件
    ↓
[誤診] 「X側がフォロー上限を設けている」と外部要因として記録される
```

**一次証拠**: 本人が手動でフォローできた → プラットフォーム制限ではない。これ1点で診断が確定した。

## 診断手順

### Step 1: state/flagファイルを直接確認

```bash
# state保存場所を特定（よくあるパターン）
find ~/dev/ ~/.config/ /tmp/ -name "*.state" -o -name "*cooldown*" -o -name "*flag*" 2>/dev/null | head -20

# JSON/YAML state の場合
cat /path/to/state.json | jq '.cooldown // .rateLimitUntil // .backoffUntil'
```

### Step 2: 期限と現在時刻を比較

```bash
# UNIXタイムスタンプの場合
COOLDOWN_TS=$(cat state.json | jq '.cooldownUntil')
NOW=$(date +%s)
echo "cooldown expires in $((COOLDOWN_TS - NOW)) seconds"
# 負の値 → フラグが期限切れなのに残っている = 自己ブロック確定
```

### Step 3: 手動操作テスト

対象の操作（フォロー・投稿・API呼び出し等）を**手動で1回試みる**。  
成功 → 自己ブロック確定。失敗 → 本物のプラットフォーム制限。

## 修正パターン

### A. cooldown期間を短縮（24h → 1h）

長期cooldownは「本当に制限がかかっている期間」を超えて永続化するリスクが高い。  
**1時間以内に再確認するよう縮める**のがデフォルト対処。

```typescript
// Before
const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

// After
const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 1h（再確認頻度を上げる）
```

### B. 旧フラグの無効化（新期間より長い古いフラグを捨てる）

```typescript
function isCooldownActive(state: State): boolean {
  if (!state.cooldownUntil) return false;
  const remaining = state.cooldownUntil - Date.now();
  // 新しいMAX期間（1h）より長い残り時間は陳腐化フラグとして無視
  if (remaining > COOLDOWN_DURATION_MS) {
    logger.warn('Stale cooldown flag detected, ignoring', { remaining });
    return false;
  }
  return remaining > 0;
}
```

### C. 検知ロジックの修正（連続失敗の誤判定を防ぐ）

```typescript
// 「成功したかどうか」の判定を強化
async function verifyActionSuccess(result: ActionResult): Promise<boolean> {
  // APIレスポンスだけでなく、実際の状態変化も確認
  // 例: フォロー → 0.5s後にフォロワーリストを再取得して確認
  await sleep(500);
  const confirmed = await checkStateChanged(result.targetId);
  return confirmed;
}
```

## 再発防止チェックリスト

- [ ] cooldown期間は**1時間以内**を上限にする（または再確認頻度を上げる）
- [ ] state保存時に`setAt`タイムスタンプも記録し、age-basedな無効化を入れる
- [ ] 「n連続失敗」カウンターをリセットするトリガーを明示する
- [ ] jobのskip理由をログに書く（`skip: cooldown, expires: ${iso}`）
- [ ] 監視アラートに「連続N回skip」を追加（0件 ≠ 正常完了）

## Pitfalls

1. **外部要因の誤診**: エラーメッセージが「rate limit」でも自己ブロックのケースがある。手動テストが最速の切り分け
2. **stateの複数箇所保存**: DB + ファイル + env で別々にcooldownを持つと一方だけ修正しても直らない
3. **成功検知の遅延**: APIが202 Acceptedを返してから反映まで時間差がある場合、すぐ確認すると失敗に見える
4. **「jobは生きてる」の誤安心**: process alive ≠ 処理実行中。skip理由のログがなければ0件は無音で続く

## 関連スキル

- `` — 実装後の自己監査でこのパターンを検出するチェック項目追加可
- `` — Codex会話ログからこのような設計欠陥パターンを抽出するルーティング判断
