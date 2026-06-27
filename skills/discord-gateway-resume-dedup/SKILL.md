---
name: discord-gateway-resume-dedup
description: 自作Discord gateway bot(WebSocket直叩き)が「前の指令を実行中」等を指令してないのに勝手に出す/同じ指令が二重実行される時。原因はRESUME再配信の未dedup。
author: auto
created: 2026-06-21
version: 1.0.0
---

## Procedure

Discord gateway を WebSocket で直接叩く自作bot(例 `~/.discord/bridge.mjs`)で、
**指令を出してないのに過去の応答/⏳busyメッセージが湧く**、または**1回の指令が二重実行**される時。

### 原因
Discord gateway はハートビート切れ→自動RESUME(op 6)のたびに、
**前回ack済み seq 以降のイベントを再配信**する。`MESSAGE_CREATE` の重複排除が無いと、
過去メッセージのリプレイで `handleMessage` が再実行され、亡霊応答や二重実行になる。
ゾンビ再接続(`if (!acked) ws.close(4000)`)を持つbotは特に頻発する。

### 修正(2点)
グローバルに起動時刻と既処理IDセットを置く:

```js
const BOOT_TIME = Date.now();                 // これより前のメッセージはリプレイ
const seenMsgs = new Set();                   // 処理済みID(再配信の重複排除)
const snowflakeTime = (id) => Number((BigInt(id) >> 22n)) + 1420070400000;
```

メッセージハンドラ冒頭(オーナー/ch判定の直後)でガード:

```js
if (m.id) {
  if (snowflakeTime(m.id) < BOOT_TIME) return; // 起動前=RESUMEリプレイ。無視
  if (seenMsgs.has(m.id)) return;              // 同一メッセージ再配信。dedup
  seenMsgs.add(m.id);
  if (seenMsgs.size > 500) seenMsgs.delete(seenMsgs.values().next().value);
}
```

### 反映
launchd管理なら kickstart で再起動(killでもKeepAliveが拾う):
```bash
launchctl kickstart -k gui/$(id -u)/<label>   # 例 com.lily.discord-bridge
```

## Pitfalls
- snowflake→ms変換は `(BigInt(id) >> 22n) + Discord epoch(1420070400000)`。22bitシフト必須。
- `seenMsgs` は無限に貯めない。上限を切ってFIFO削除(上の500件ローテ)。
- busy/in-flightフラグの解除は必ず `finally` に置く。runClaude等がハングするとフラグが残り、
  dedupとは別経路で「実行中」が居座る。dedup入れても解除漏れは別途潰す。
- close時の再接続は resume可能コード(4000,4001,1006等)で resume、不可なら fresh。
  dedupはどちらの経路でも効く。

## Verification
- 修正後 `node --check bridge.mjs` で構文OK。
- 再起動しログに `READY as <bot>` が出る(`bridge.out.log`)。
- 一定時間放置→再接続が起きても、過去指令が再生されないこと。
- 1指令=1応答(▶️受付→✅完了が1回ずつ)で二重化しないこと。
