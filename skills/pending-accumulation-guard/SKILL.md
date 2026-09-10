---
name: pending-accumulation-guard
description: 非同期ジョブが requeue/retry を繰り返すのにカウンタ未永続化で失敗が立たず pending が事実上の終端状態になる anti-pattern の検出・修正パターン
tags: [async, job-queue, retry, requeue, monitoring]
origin: production incident, 39h pending stuck job
next-review: 2027-08-21
---

# pending-accumulation-guard

## 問題の型

```
T0: Job 受付 → status=pending
T1: Worker が quota hit → requeueJob() → {ok: true} → status=pending (カウンタ増えず)
T2: Worker が quota hit → requeueJob() → {ok: true} → status=pending
...
T39h: タイムアウト → status=failed (ようやく失敗が立つ)
```

**症状**: 監視は鳴らない・失敗カウントはゼロ・UIは「作成中」のまま・中止も再実行もできない。  
**根因**: requeue の「成功」がカウントされないため、7回目と1回目が実装から区別できない。

## 検出チェックリスト

```bash
# 1. requeue ロジックを持つファイルを探す
grep -r "requeue\|requeueJob\|enqueue.*retry\|queue\.add.*attempts" src/ --include="*.ts"

# 2. Job モデルに retryCount / quotaHits 系フィールドがあるか確認
grep -r "retryCount\|quotaHits\|attemptNumber\|failedAttempts" src/ --include="*.ts"

# 3. give-up 条件（上限チェック）があるか確認
grep -r "MAX_RETRY\|QUOTA_GIVE_UP\|maxAttempts\|>= MAX" src/ --include="*.ts"

# 4. pending が長時間続いているジョブをDBで確認
# SELECT * FROM jobs WHERE status='pending' AND created_at < NOW() - INTERVAL '1 hour';
```

いずれか1項目が欠けていたら **このパターンが潜在している**。

## 修正パターン（TypeScript / Prisma 例）

### Step 1 — Job モデルにカウンタを追加

```prisma
model Job {
  id          String   @id
  status      JobStatus
  createdAt   DateTime @default(now())
  
  // 追加: 理由ごとにカウンタを分ける
  quotaHits   Int      @default(0)   // クォータ起因の requeue 回数
  resumeAt    DateTime?              // 次再開予定時刻
}
```

> **重要**: `requeueStale`（タイムアウト起因）はカウントを増やさない。  
> 理由が混在するとカウンタの意味が薄れ give-up 条件が曖昧になる。

### Step 2 — requeueJob() の戻り値にカウンタを含める

```typescript
async function requeueJob(jobId: string): Promise<{ ok: boolean; quotaHits: number }> {
  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'pending',
      quotaHits: { increment: 1 },
      resumeAt: new Date(Date.now() + QUOTA_RESUME_MS),
    },
  });
  return { ok: true, quotaHits: job.quotaHits };
}
```

### Step 3 — 二重条件の give-up を実装

```typescript
const QUOTA_GIVE_UP_MS = 3 * 60 * 60 * 1000; // 3h

async function processJob(jobId: string) {
  try {
    await runWorker(jobId);
  } catch (err) {
    if (isQuotaError(err)) {
      const { quotaHits } = await requeueJob(jobId);

      // 二重条件: カウント OR 経過時間
      const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
      const elapsed = Date.now() - job.createdAt.getTime();
      const shouldGiveUp = quotaHits >= 1 || elapsed > QUOTA_GIVE_UP_MS;

      if (shouldGiveUp) {
        // 新経路を作らず既存の失敗経路へ寄せる
        await report(jobId, { error: 'quota_exhausted', quotaHits, elapsed });
      }
    } else {
      await report(jobId, { error: err.message });
    }
  }
}
```

> **片方だけでは不十分な理由**:  
> - `quotaHits >= 1` だけ: 1回目のクォータ拒否で即失敗（リトライが全く効かない）  
> - `elapsed > 3h` だけ: 連続クォータ拒否でも3h待つ（今回の39h問題の縮小版）  
> 両方を OR で組み合わせて「即諦め or 長すぎる場合に諦め」を実現する。

### Step 4 — UI の正直表示（fake progress を消す）

```
❌ 悪い: [=====>       ] 作成中...（アニメが動いているが進行していない）
✅ 良い: AIの順番待ちです。◯時◯分ごろ作成を再開します。この画面を閉じても順番は保たれます。
```

```typescript
// resumeAt をUIに渡す
const etaText = job.resumeAt
  ? `${format(job.resumeAt, 'H時m分')}ごろ再開予定`
  : 'しばらくお待ちください';
```

### Step 5 — 監視アラームの追加

```sql
-- pending が 30分以上続いているジョブ数 > 0 で Slack アラーム
SELECT COUNT(*) FROM jobs
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 minutes';
```

```typescript
// または Upstash QStash の deadLetterQueue を設定
const client = new QStash({ token: process.env.QSTASH_TOKEN });
await client.publishJSON({
  url: WORKER_URL,
  body: { jobId },
  retries: 1,                          // QStash 側のリトライは最小限
  failureCallback: DLQ_CALLBACK_URL,   // DLQ で検知
});
```

## Pitfalls

| # | 落とし穴 | 対策 |
|---|---------|------|
| 1 | `requeueStale` もカウントに含める | 理由ごとにカウンタを分ける（quotaHits vs staleHits） |
| 2 | give-up 条件を単一にする | OR で二重条件にする |
| 3 | 既存の report() 経路を使わず新経路を追加 | 既存の失敗経路に寄せる（デバッグ経路が増えると見落とし増） |
| 4 | UIにアニメ進捗バーを残す | pending 中はアニメを止め ETA を表示する |
| 5 | DB に pending が積んでも監視が鳴らない | pending 長時間クエリ or DLQ を監視に追加 |
| 6 | カウンタを永続化せずメモリに持つ | Worker 再起動でリセット → 無限ループ再現 |

## 実績

- **本番の動画生成キュー(2026-08)**: quotaHits + QUOTA_GIVE_UP_MS 二重条件を導入し、39時間 pending が 0時間（1回目のクォータ拒否で即 failed）に短縮。
