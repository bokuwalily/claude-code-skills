---
name: codex-cli-setup
description: OpenAI Codex CLIをインストールし認証して、Claudeのbashツールや自動化スクリプトからノンインタラクティブで呼び出せるようにするときに使う
author: auto
created: 2026-05-28
version: 1.1.0
status: active
disallowed-tools: Agent Edit
disable-model-invocation: true
---

## Procedure

1. **インストール**

```bash
npm i -g @openai/codex
# または
npm install -g @openai/codex
```

インストール後、バイナリが通っているか確認：

```bash
codex --version
# 例: 0.133.0
```

2. **認証**

```bash
codex login
# ブラウザが開いてOpenAIアカウントでサインインするよう求められる
# ブラウザ認証が完了するとCLIがトークンを自動保存する
```

API keyを直接指定する場合（非インタラクティブ環境向け）：

```bash
export OPENAI_API_KEY="sk-..."
codex --api-key "$OPENAI_API_KEY" exec "プロンプト"
```

3. **ノンインタラクティブ実行**

```bash
# Gitリポジトリ外での実行（--skip-git-repo-checkが必要）
codex exec --skip-git-repo-check "タスクの説明をここに書く"

# モデルを指定する場合
codex exec --model gpt-4o --skip-git-repo-check "プロンプト"

# 出力をファイルに保存
codex exec --skip-git-repo-check "プロンプト" > output.txt
```

4. **ClaudeのBashツールからの呼び出し**

Claudeセッション内では以下のように利用可能：

```bash
# Claude Codeの ! プレフィックスまたはBashツールから
codex exec --skip-git-repo-check "このコードのバグを見つけて修正案を提示して"
```

## Pitfalls

- **`--skip-git-repo-check`** はGitリポジトリ外（tmp, home直下等）で実行する際に必須。付けないとエラーになる
- **インタラクティブ認証不要**: APIキーを環境変数で渡すほうが自動化に向いている。`codex login` はブラウザを開くため、SSH環境や自動スクリプトでは使えない
- **PATHが通らない場合**: `npm i -g` のグローバルパスがPATHに含まれていないことがある。`npm bin -g` でパスを確認して `.zshrc`/`.bashrc` に追加する
- **既存のcodex設定が残っている場合**: `~/.codex/` にキャッシュが残っていても、バイナリがPATHにないと動かない。インストールが必要

## Verification

```bash
# バージョン確認（バイナリの存在確認）
codex --version

# 簡単なタスクで動作確認
codex exec --skip-git-repo-check "Hello と出力するPythonスクリプトを1行で書いて"
# → print('Hello') のような出力が返ればOK
```
