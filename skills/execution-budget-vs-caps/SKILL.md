---
name: execution-budget-vs-caps
description: caps×遅延/サイズの積が実行枠を超えるとSIGKILL/サイレント打ち切りになる。コードに1行もバグがなくても毎日壊れる型と、自分から締切前に止まる実装パターン。
author: auto
created: 2026-08-14
version: 1.0.0
tags:
  - automation
  - launchd
  - playwright
  - reliability
  - budget
related:
  - conv-log-birthtime-fallback
  - automation-bool-selector-pitfalls
  - automation-stale-cooldown-flag
---

# execution-budget-vs-caps — 器のサイズを実装が知らないまま動く型

## 問題の本質

「upper caps」と「その caps に到達するまでにかかる時間・容量」を別々の場所に書くと、  
**どの行も正しいのに組み合わせだけが毎日壊れる**。

```
caps × delay_avg + jitter > container_limit  →  外部からSIGKILL / 黙って切り捨て
```

コードレビューで見つからない。なぜなら **どの設定も個別には正しい**から。  
見つかるのは算術（積）だけ。

---

## 4つの器と実例（2026-08-12窓）

| 器 | プロジェクト | 実装が知らなかった上限 | 実害 |
|---|---|---|---|
| **時間** | o81-brand `ig_engage.py` | `BROWSER_SLOT_TIMEOUT_SEC=2400` | caps101×avg40s+jitter900=5040s → 毎日 **exit 124 (SIGKILL)** |
| **文字数** | lily-line-funnel `pdca.mjs` | Discord 1メッセージ **2000字** | レポート長い日は通知ごと落ちる |
| **画素（撮影）** | note-autolike 表画像 | Chrome `--headless=new` はウィンドウサイズをそのまま撮る | 1760×4000px（白余白巨大）で公開 |
| **画素（生成）** | ai-portraits | 内蔵imagegen の出力は指定と違う寸法で返る | `sips` 正規化の不統一 |

---

## 診断チェックリスト（自動化ジョブが「バグなし・毎日失敗」なら）

```bash
# 1. exit code を確認（124=SIGKILL 候補）
grep "exit_code" ~/.logs/<job>.log | tail -20

# 2. caps × delay の積を計算
python3 -c "caps=101; delay_avg=40; jitter=900; timeout=2400; print(caps*delay_avg+jitter, '>',timeout, '?', caps*delay_avg+jitter > timeout)"

# 3. 実行枠の設定元を確認（launchd は TimeOut、docker は --timeout、etc）
grep -r "TIMEOUT\|TimeOut\|slot_timeout" ~/dev/<project>/ --include="*.py" --include="*.plist"

# 4. Discord: レポートの最大文字数を測る
python3 -c "import json; r=json.load(open('report.json')); print(len(r['body']))"

# 5. Chrome: headless screenshot の実寸を確認
file output.png  # → dimensions
```

---

## 実装パターン：自分から締切前に止まる

### 1. 時間予算（Python / launchd）

```python
import os, time

def compute_budget() -> float | None:
    """環境変数が消えたら None → 既存挙動を1ミリも変えない"""
    raw = os.environ.get("IG_ENGAGE_BUDGET_SEC") \
       or os.environ.get("BROWSER_SLOT_TIMEOUT_SEC")
    if not raw:
        return None
    return float(raw)

BUDGET_MARGIN_S = 120  # 終了処理のバッファ
budget = compute_budget()
deadline = (time.time() + budget - BUDGET_MARGIN_S) if budget else None

def over_budget() -> bool:
    return deadline is not None and time.time() > deadline

# 各ループの先頭に相乗り（新しいクラス・ブロック不要）
if blocked["hit"] or over_budget():
    break

# jitter も残予算の20%でクランプ
jitter_max = min(900, (deadline - time.time()) * 0.2) if deadline else 900
```

### 2. 文字数制限（Discord 2000字チャンク分割）

```javascript
function chunkDiscord(text, limit = 1990) {
  // サロゲートペア考慮: [...s].length
  const chars = [...text];
  const chunks = [];
  let buf = [];
  for (const c of chars) {
    if (buf.length >= limit) {
      chunks.push(buf.join(""));
      buf = [];
    }
    buf.push(c);
  }
  if (buf.length) chunks.push(buf.join(""));
  return chunks;
}

// エラー本文はDiscordには先頭800字、ログには全文
await sendDiscord(errorMsg.slice(0, 800) + (errorMsg.length > 800 ? "…" : ""));
console.error("FULL:", errorMsg);  // ログ側は全文
```

### 3. Chrome headless screenshot（2パス化）

```bash
# パス1: scrollHeight を取得（ウィンドウ高さは小さくする=200）
HEIGHT=$(chromium --headless=new --window-size=1760,200 \
  --dump-dom "$URL" | python3 -c "
import sys; from html.parser import HTMLParser
# scrollHeight相当を body height から取得
...")

# パス2: 実寸で撮影
chromium --headless=new --window-size="1760,${HEIGHT}" \
  --screenshot="$OUT" "$URL"
```

### 4. 画像生成後の強制正規化

```bash
# 生成ツールのアスペクト指定は信用しない。保存後に毎回正規化
TARGET_W=1024; TARGET_H=1280
sips -z "$TARGET_H" "$TARGET_W" "$OUTPUT_FILE"

# 実寸を読んで確認（ログに残す）
ACTUAL=$(sips --getProperty pixelWidth --getProperty pixelHeight "$OUTPUT_FILE" \
  | grep -E "pixel(Width|Height)" | awk '{print $2}' | paste -sd'x')
echo "normalized: $ACTUAL (expected: ${TARGET_W}x${TARGET_H})"
```

---

## 🔴 silent-success 罠と対策

打ち切りを `exit 0` にした瞬間、「毎日ちゃんど動いているが成果は半分」が誰にも見えなくなる。

```python
# state/engage_budget.json で連続打ち切り日数を追跡
import json, pathlib, datetime

STATE_FILE = pathlib.Path("state/engage_budget.json")

def record_budget_cutoff(likes, follows, unfollows, caps):
    state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    today = datetime.date.today().isoformat()
    if state.get("last_date") == today:
        return  # 同日2回目は無視
    streak = state.get("streak", 0) + 1 if state.get("last_date") else 1
    state.update({"streak": streak, "last_date": today})
    STATE_FILE.write_text(json.dumps(state))

    # 3日連続かつ今日まだ通知してない場合のみアラート
    last_alert = state.get("last_alert_date", "")
    if streak >= 3 and last_alert != today:
        state["last_alert_date"] = today
        STATE_FILE.write_text(json.dumps(state))
        send_alert(
            f"capsが実行時間に対して過大：予算到達での打ち切りが{streak}日連続\n"
            f"実績: likes={likes}/{caps['likes']}, follows={follows}/{caps['follows']}"
        )
```

**ルール**: 単発1日は鳴らさない（重い日で狼少年）。毎日は鳴らさない（読まれなくなる）。**3日連続＋1日1回**。

---

## 設定値の書き方（積を最初から持つ）

```python
# ❌ 悪い：caps と delays を別々の定数にする
CAPS = {"likes": 62, "follows": 24, "unfollows": 15}
ACTION_DELAY_AVG = 40  # seconds
TIMEOUT = 2400

# ✅ 良い：必ず積を計算してログに出す
total_actions = sum(CAPS.values())  # 101
estimated_sec = total_actions * ACTION_DELAY_AVG + JITTER_MAX  # 4940s
if estimated_sec > TIMEOUT:
    logger.warning(f"caps×delay={estimated_sec}s > timeout={TIMEOUT}s — 予算超過リスク")
```

LINE月間上限のような「月次枠」も同様:

```python
# LINE 無料枠 200通/月 → 180で強制停止（10%バッファ）
LINE_MONTHLY_CAP = 200
LINE_MONTHLY_SOFT_LIMIT = int(LINE_MONTHLY_CAP * 0.9)  # 180
```

---

## Pitfalls

1. **SIGKILL は finally を通らない**: `ctx.close()` / ファイルclose / ロック解除が全部スキップされる。Chromium孤児化・ロックファイル残留が発生 → 
2. **launchd TimeOut デフォルト** は 30秒（短い）。`BROWSER_SLOT_TIMEOUT_SEC` などの環境変数が設定元と食い違う場合がある。実設定は `launchctl print system/<label>` で確認
3. **jitter を残予算から引く**: jitterを固定max(=900)にすると、予算の大半がjitterで消える。`min(jitter_max, remaining * 0.2)` でクランプ
4. **Discord文字カウント**: `len(s)` はバイト数ではなくPythonコードポイント数。サロゲートペア（絵文字等）は `[...s].length`（JS）/ `len(s)` (Python3 unicode)で正しい
5. **Chrome scrollHeightの落とし穴**: パス1のウィンドウ高さを大きくすると（例:2000）、scrollHeightが2000未満にならず同じバグが残る。**パス1の高さは200など小さくする**

---

## 関連スキル / wiki

-  — 同じ08-12窓のmtime汚染対処
-  — 自動化の別型（boolean戻り値忘れ）
- `~/.claude/wiki/learning/execution-budget-vs-caps.md` — 正典（実測値・実装コード）
- `~/.claude/wiki/learning/silent-success-antipattern.md` — exit 0化の穴
