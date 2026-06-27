---
name: project-exploration-patterns
description: 新規 / 既存プロジェクトのコードベースを最短で把握するための ls/grep/find/tree 組み合わせパターン集。発火: 新規プロジェクトに入った時、特定 module を探す時、コード構造を理解する時
author: auto
created: 2026-05-30
version: 1.0.0
status: active
disallowed-tools: Agent Edit Write
---

## Procedure

### Pattern A: 全体構造把握
新しいプロジェクトに入った直後、root の地形を 30 秒で掴む。

```bash
# ディレクトリ階層を 3 階層まで（深く掘らない）
find <project> -maxdepth 3 -type d \
  -not -path '*/node_modules*' \
  -not -path '*/.next*' \
  -not -path '*/.git*' \
  -not -path '*/dist*' | head -30

# root の files
ls -la <project>

# entry point / scripts を確認
cat <project>/package.json | jq '.scripts, .dependencies | keys'
# Python: cat pyproject.toml / Cargo.toml / go.mod も同様
```

### Pattern B: 関数/シンボル探索
特定の関数や export を素早く見つける。

```bash
# シンボル名直撃（ripgrep 推奨）
rg -n "function_name" <project>/src --type ts

# fallback で grep
grep -rn "function_name" <project>/src --include='*.ts' \
  --exclude-dir=node_modules --exclude-dir=dist

# export だけ列挙
rg -n "^export (function|const|class) \w+" src --type ts
```

### Pattern C: import 依存追跡
どのモジュールが何を使っているか俯瞰。

```bash
# alias import (`@/...`) の使用箇所
rg -n "from ['\"]@/" src

# 特定ライブラリの import 全件
rg -n "import .* from ['\"]lodash" .

# 逆向き: 自作モジュールがどこから import されているか
rg -n "from .*/utils/format" src
```

### Pattern D: 最近変更
直近の変更で何が動いているかを把握。

```bash
# 直近 7 日のコミット
git log --oneline --since='7 days ago' -- <path>

# 最近 5 commit の差分サマリ
git diff HEAD~5..HEAD --stat

# ファイルごとの最終更新
git log -1 --format='%ai %s' -- <file>
```

## Pitfalls

- `node_modules` / `.next` / `dist` / `.git` を除外しないと find/grep が遅く、ノイズが多い。`--exclude-dir` か `find -not -path` で必ず除く。
- 大規模 monorepo で `find` が秒単位かかるなら ripgrep (`rg`) に切り替える。`rg` は `.gitignore` を自動尊重する。
- `grep -r` で `--include='*.ts'` を付けないと minified JS や lock file まで舐めて壊れる。
- `jq` が無い環境では `node -e "console.log(Object.keys(require('./package.json').scripts))"` で代替。
- Pattern A の `find -maxdepth 3` は深い monorepo (`packages/*/src/...`) では浅すぎる。その時は 4-5 に上げる。

## Verification

- Pattern A の出力が 50 行未満で、root レイアウト・主要ディレクトリ・entry point が一目で分かる。
- Pattern B/C で目的のシンボルが見つかる。export 数と import 数の整合（孤立した export は dead code 候補）。
- Pattern D で直近の活発な領域 = 今コンテキストとして読むべき領域、と対応している。
- 全 Pattern を実行しても 30 秒以内に終わる。超えるなら除外フィルタかツール (`rg`) を見直す。
