---
name: cross-automation-shared-resource-kill
description: 自分の自動化Aが別の自動化Bの永続状態（セッション・クッキー・DBロック・キャッシュファイル等）を毎日破壊していた場合の診断・検出・防止パターン。壊す側と壊れたと報告する側が別リポジトリにある場合に片方だけ見ても原因に辿り着けない型。
author: auto
created: 2026-08-28
version: 1.0.0
tags: [automation, shared-resource, cross-repo, session, state-corruption, debugging]
related: [automation-stale-cooldown-flag, web-automation-false-success-guard, metric-source-attribution]
disallowed-tools: [Agent]
---

## 問題

**複数の自動化が同一の永続リソース（ファイル・DB行・セッション）を共有している場合、
一方が無意識にそのリソースを削除・上書き・無効化する。**

### 実例

```
症状: Instagram への投稿が丸1日ゼロ
報告: automation-A → 「ログイン切れ」エラー
真因: 別リポジトリの automation が cookies/session ファイルを
      毎日削除 or 上書きしており、automation-A が取得したセッションが
      翌朝には無効化されていた
```

**診断の罠**: `automation-A` リポジトリだけを調査すると「ログイン切れ → 再ログイン処理を書く」
という誤った修正方向に進む。**壊す側は別リポジトリにある**ため、単一リポジトリの調査では
根本原因に到達できない。

## 検出パターン

### 1. 共有ファイルの書き込み履歴を追う

```bash
# セッション/クッキー/状態ファイルへの書き込みを全リポジトリで横断検索
SHARED_FILE="$HOME/.config/ig-session/cookies.json"

# 最終書き込みプロセスを特定（lsof / fs_usage）
sudo fs_usage -w -f filesys | grep "$(basename $SHARED_FILE)"

# 全 launchd plist でそのパスを参照しているものを検索
grep -r "$(basename $SHARED_FILE)" \
  ~/Library/LaunchAgents/ \
  ~/Library/LaunchDaemons/ \
  ~/.claude/scripts/ \
  ~/dev/ \
  2>/dev/null | grep -v ".git"
```

### 2. ファイルの変更タイムラインを記録する番兵スクリプト

```bash
#!/usr/bin/env bash
# guard-shared-state.sh — 共有ファイルの mtime 変化を JSONL に記録
WATCH_FILE="${1:?usage: $0 <file>}"
LOG="$HOME/.claude/logs/shared-state-guard.jsonl"

PREV_MTIME=$(stat -f "%Sm" -t "%s" "$WATCH_FILE" 2>/dev/null || echo 0)

while true; do
  sleep 60
  NEW_MTIME=$(stat -f "%Sm" -t "%s" "$WATCH_FILE" 2>/dev/null || echo 0)
  if [ "$NEW_MTIME" != "$PREV_MTIME" ]; then
    # 変化を記録 + 書き込みプロセスを特定
    WRITER=$(lsof "$WATCH_FILE" 2>/dev/null | awk 'NR>1{print $1,$2}' | head -3)
    echo "{\"ts\":\"$(date -u +%FT%TZ)\",\"file\":\"$WATCH_FILE\",\"prev\":$PREV_MTIME,\"new\":$NEW_MTIME,\"writer\":\"$WRITER\"}" \
      >> "$LOG"
    PREV_MTIME=$NEW_MTIME
  fi
done
```

### 3. 診断チェックリスト（症状から原因へ）

| 症状 | 確認すべきこと |
|------|----------------|
| A が「認証切れ」で失敗し続ける | A と同じ session ファイルを使う他の automation はないか |
| B が書いたキャッシュが毎朝消える | B の実行前後で `ls -la` タイムスタンプが戻っていないか |
| C が取得したデータが即座に上書きされる | 同一 DB テーブル/行に書く D はないか |
| エラーが「突発的」でなく「毎日同じ時刻」に起きる | cron/launchd のスケジュールと時刻を比較する |

---

## 防止パターン

### 1. 共有リソースを per-automation 名前空間で分離

```bash
# BAD: 全 automation が同じファイルを使う
SESSION_FILE="$HOME/.config/ig/cookies.json"

# GOOD: automation ごとにサブディレクトリを分ける
SESSION_FILE="$HOME/.config/ig/cookies-${AUTOMATION_NAME}.json"
# automation-A → cookies-automation-A.json
# automation-B → cookies-automation-B.json
```

### 2. 削除前に「所有者」を確認するラッパー

```python
import os, json, pathlib

OWNERSHIP_MANIFEST = pathlib.Path.home() / ".config" / "shared-resources.json"

def safe_delete(path: str, caller: str) -> bool:
    """共有リソースの所有者を確認してから削除する"""
    manifest = json.loads(OWNERSHIP_MANIFEST.read_text()) \
        if OWNERSHIP_MANIFEST.exists() else {}
    owner = manifest.get(path)
    if owner and owner != caller:
        print(f"[BLOCKED] {caller} tried to delete {path} owned by {owner}")
        return False
    os.remove(path)
    return True
```

### 3. クリーンアップ系スクリプトの影響範囲を明示

```bash
# cleanup.sh に必ず影響ファイルリストを記述し、
# 他 automation から参照されていないか確認する

CLEANUP_TARGETS=(
  "/tmp/ig-cache-*"
  "$HOME/.config/ig/temp-*.json"
  # ← ここに追加する前に grep で参照者を確認:
  #   grep -r "ig/temp-" ~/dev/ ~/Library/LaunchAgents/
)
```

---

## 診断手順（再発時のRunbook）

```bash
# Step 1: 症状の時刻を特定
grep "ERROR\|FAIL\|認証" ~/.claude/logs/automation-*.jsonl | tail -20

# Step 2: その時刻帯に書き込みがあったファイルを洗い出す
find ~/.config/ ~/dev/ -newer /tmp/timestamp_before -not -newer /tmp/timestamp_after \
  -type f 2>/dev/null | head -30
# 事前に: touch -t YYYYMMDDHHMM /tmp/timestamp_before

# Step 3: 全 launchd タスクのスケジュールと照合
for plist in ~/Library/LaunchAgents/*.plist; do
  label=$(defaults read "$plist" Label 2>/dev/null)
  interval=$(defaults read "$plist" StartInterval 2>/dev/null || echo "N/A")
  echo "$label: $interval"
done | sort

# Step 4: 症状の時刻と重なる launchd タスクを特定し、スクリプトを調査
```

---

## Pitfalls

1. **単一リポジトリ調査の罠**: 症状が出るリポジトリだけを見ても原因に辿り着けない。
   必ず全 launchd/cron/automation のスケジュールを横断比較する。
2. **「ログイン切れ」への誤誘導**: セッション無効化の真因がファイル上書きの場合、
   再ログイン処理を追加しても根本解決にならない（毎日再発）。
3. **mtime での検出限界**: `find -newer` は mtime 汚染（一括 re-index）で誤検知する。
   birthtime を使うか fs_usage/lsof でプロセスを直接特定する。
4. **Cleanup スクリプトのワイルドカード**: `rm /tmp/project-*` が意図しない automation の
   一時ファイルも巻き込むことがある。削除前に `ls /tmp/project-*` で確認する。
5. **時刻比較のタイムゾーン**: launchd の StartCalendarInterval は local time、
   cron は UTC の場合がある。JST/UTC の混在に注意。

## Verification

```bash
# 番兵スクリプト稼働確認（ログが増え続けているか）
tail -5 ~/.claude/logs/shared-state-guard.jsonl

# 修正後、症状が再発していないか（症状の時刻に mtime 変化が無いこと）
```
