---
name: zsh-reserved-variable-traps
description: zshスクリプトで読み取り専用予約変数に代入しようとすると無音で失敗（bashとの罠の差）。`status=$?` が典型。安全な命名パターンと主要予約変数一覧を収録。
author: auto
created: 2026-07-19
version: 1.0.0
related:
  - macos-hook-path-timeout
  - hook-log-append-pattern
---

## 背景・発生条件

zsh には bash にない **読み取り専用の予約変数** が存在する。スクリプト内でこれらに代入すると、エラーメッセージが出ないまま代入が無視される（= サイレント失敗）。

実際の障害例（2026-07-18 note-autolike プロジェクト）:

```zsh
# ❌ zsh では status は read-only 予約変数
status=$?
if ; then
  notify_failure   # ← 永遠に呼ばれない！
fi
```

→ `notify_failure` が全滅し、失敗通知が届かなくなった。bash では動く。

## 主要 zsh 予約変数（代入禁止）

| 変数名 | 意味 | 代替名 |
|--------|------|--------|
| `status` | 最後のコマンド終了コード（`$?` の別名） | `rc` / `exit_code` / `_rc` |
| `signals` | シグナル名配列 | `sigs` |
| `commands` | コマンドハッシュ | `cmds` |
| `options` | setopt 状態 | `opts` |
| `aliases` | エイリアス辞書 | `als` |
| `functions` | 関数一覧 | `funcs` |
| `modules` | ロード済みモジュール | `mods` |
| `history` | 履歴配列 | `hist_arr` |
| `path` / `PATH` | PATH 配列 | 小文字 `path` は配列版（読書可）。代入は注意 |

> **見分け方**: `typeset -r` の出力に含まれる変数が read-only 候補。  
> 確認: `echo ${(t)status}` → `integer-readonly-special` など special を含む。

## 診断コマンド

```zsh
# 変数が予約/read-only かどうか確認
echo ${(t)status}    # → "integer-readonly-special" なら禁止
echo ${(t)rc}        # → "" (未定義) → 安全に使える

# zsh で read-only 変数一覧
typeset -r | grep '='
```

## 安全な命名パターン

```zsh
# ✅ 安全：rc / exit_code / _rc を使う
rc=$?
if ; then
  echo "FAILED: exit=$rc"
fi

# ✅ スクリプト全体で一貫して使う
run_and_check() {
  "$@"
  local rc=$?
   && echo "ERROR: $* returned $rc"
  return $rc
}
```

## シェル判定（bash/zsh 両対応スクリプト）

```zsh
# bash と zsh を両対応させる場合は status を避ける
# bash: $? が上書きできる (status は普通の変数として使える)
# zsh:  status は read-only なのでどちらでも rc を使う方が安全
```

## Pitfalls

| 罠 | 症状 | 対策 |
|----|------|------|
| `status=$?` | 代入無視・条件分岐が常に偽 | `rc=$?` に改名 |
| `options=(foo bar)` | 無音で失敗 | `my_opts=(foo bar)` |
| `commands[git]=...` | ハッシュ操作が効かない | `hash -d git=...` を使う |
| bash スクリプトをそのまま `.zsh` に改名 | 差異が顕在化 | shebang + `set -e` 後に `bash -n` & `zsh -n` 両方チェック |
| `functions[myfunc]` 参照 | 意図しない関数リストが返る | 変数名を `my_functions` 等に変更 |

## 発見したら即やること

```bash
# zsh スクリプト内の危険な代入をスキャン
grep -n '\bstatus=' your_script.zsh
grep -n '\bsignals=\|\bcommands=\|\boptions=\|\baliases=' your_script.zsh
```

## 関連スキル

- `` — macOS hook の PATH 問題（同じく無音失敗系）
- `` — hook スクリプトでの JSONL ログ追記
