---
name: codex-delegation-handoff
description: 実装タスクをCodex(codex exec)へ委譲する時に毎回使う「投げ方＋検証」の固定型。Codexが空振り(timeout/空出力/的外れ実装/別dir書込み)する根本原因=別プロセスで文脈非共有+指示が緩い、を構造的に潰す。ChatGPT Pro枠を活かしてClaude Codeトークンを節約したい時。何をCodexに振るかの判断は、bridge常駐会話は、CLI疎通は。
author: auto
created: 2026-06-26
version: 1.0.0
---

## Procedure

Codexは**別プロセスでセッション文脈を自動共有しない**。だから「いつものあれ直して」では必ず空振る。投げる前にこの5点を指示文へ全部埋め込む。1つでも欠けたら空振り率が跳ね上がる。

### 1. 投げる前（指示の組み立て＝ここが9割）

委譲指示は必ず次の構造で1つの文字列に固める:

```
作業dir: ~/dev/<proj> （絶対パス。codexのpwdは不定）
対象ファイル: @/abs/path/a.ts @/abs/path/b.ts …（散在しても全部 @file で列挙）
やること: <具体的に。何を作る/変える>
完了条件: <箇条書き。例「foo()がXを返す」「npm test が緑」>
禁止: 上記対象以外のファイルは触らない / 新規依存を勝手に足さない
検証: 実装後に <検証コマンド> を自分で実行し、結果を最後に報告
```

- **@file列挙が最重要**。Codexは渡されたファイルしか確実には読まない。「このリポの〜」式の曖昧参照は空振りの第一原因。
- 出力先（作成/編集するファイルのパス）を明示する。「いい感じに」は厳禁。
- 完了条件は機械検証可能な形に。テストがあるなら「npm test が緑」を入れる。

### 2. 呼び出し（非対話・ハング防止）

```bash
cd ~/dev/<proj>   # 作業dirへ
timeout 600 codex exec --skip-git-repo-check \
  --output-last-message /tmp/codex-out.txt \
  "<上で組んだ指示>" </dev/null
```

- `</dev/null` 必須（stdin閉じないとハングする）
- `--skip-git-repo-check` 必須（非gitでも動かす）
- `timeout 600` で囲う（無反応をOSに刈らせる。重いタスクは900〜1200に）
- `--output-last-message <file>` で**最終返答だけ**を別取得（stdoutに推論ログが混ざるため）

### 3. 投げた後（検証＝Claudeトークン最小で詐称を弾く）

**stdoutに「実装しました」と書いてあっても完了扱いにしない。ファイルが実際に変わるまで未完。**（）

```bash
git -C ~/dev/<proj> diff --stat   # 実変更があるか
ls -la <期待した出力ファイル>                      # 存在＋mtimeが今か
```

判定:
- diffが空 / 期待ファイルが無い / mtimeが古い → **空振り**。原因（@file漏れ・作業dir違い・timeout）を特定して投げ直す。2回空振ったら `Agent(model:"sonnet")` へフォールバック（同セッション文脈を引き継げる）。
- 変更あり → Opusで diff を軽くレビュー（設計・契約・セキュリティだけ見る。行単位の粗探しは不要）。

## Pitfalls

- **@file漏れ＝最大の空振り原因**。対象が複数dirに散るなら全部絶対パスで列挙。文脈共有が重いタスクは最初からSonnetサブエージェント向き（Codexに固執しない）。
- **多バイト変数の罠**: 全角文字直後の `$VAR` はbashが後続バイトを変数名に取り込む。指示文をヒアドキュメントで組むなら `${VAR}` と波括弧必須。
- **別dirへの書き込み事故**: 作業dirを絶対パスで固定しないと、codexがホームや一時dirに書いて「やった」と言う。投げ後の `git diff --stat` で必ず実体確認。
- **コスト枠**: codex exec 1回 ≈ 20k+ トークン消費するが、これは**ChatGPT Pro枠（Claude MAXとは別枠）**。Claude Codeのトークンを食わないのが委譲の目的そのもの。逆に検証で大量diffをOpusに読ませると本末転倒なので、検証はコマンド出力（--stat / ls）で済ませる。
- **会話往復が要るタスクには向かない**: 1往復で完結する独立・定型・大規模が適。設計と密に往復するならかSonnetサブエージェント。
- **入力の実在を委譲前に解決する（重要）**: 「N件をソースから処理」型は、委譲前に**全Nソースが期待パスに実在するか自分で確認**してから渡す。欠落を残すとCodexがSPECの「欠落はskip」指示を超えて**勝手に別dirからコピー補完し、ライブ誤上書きの危険**を生む（実例: posted 19本のうち5本のソースが`~/articles`に無く、Codexが`~/articles-pending`から自己判断でコピー）。設計＝入力の正規化まで含めてOpusが完了させ、委譲先に補完の余地を残さない。ライブ破壊系(API PATCH/削除)はCodexは実装+dry-runまで、実行は人間が1件検証→全件。

## Verification

型が機能しているかは「投げて→git diffで実変更が出るか」で測る:

```bash
cd ~/dev/<proj>
timeout 600 codex exec --skip-git-repo-check --output-last-message /tmp/c.txt \
  "作業dir: $(pwd) / 対象: @$(pwd)/README.md / やること: 末尾に1行 'codex-handoff verified' を追記 / 完了条件: その行が存在 / 検証: tail -1 README.md" </dev/null
git diff --stat            # README.md が変更されていれば型OK
git checkout README.md     # 検証後は戻す
```

diffにファイルが出れば「投げ方→検証」のループが通っている。空振りなら指示文の@file/作業dirを見直す。
