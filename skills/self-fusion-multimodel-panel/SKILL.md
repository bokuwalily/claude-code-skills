---
name: self-fusion-multimodel-panel
description: 重い判断・深掘りリサーチをするとき、OpenRouter Fusion(有料API)を使わずローカルで多モデル合議を回したい時に発火。Claude複数視点+Codexの別モデルをパネルにし、judgeで合意点/矛盾/盲点を抽出→synthesizerで統合。MAX+Codex定額内で追加課金ゼロ。
author: auto
created: 2026-06-15
version: 1.0.0
---

## Procedure

OpenRouter Fusionの「panel→judge→synthesize」を Workflow ツールでローカル再現する。本家との違いは、有料APIを叩かず Claude MAX + Codex CLT(定額) だけで回す点。価値の3/4は"統合(judge+synth)"、1/4は"多様性"なので、Codexを1枚混ぜて多様性も確保する。

1. **問いを1つの `QUESTION` 定数にまとめる。** 抽象NG。前提(依頼者の実状・既知の数値・制約)を全部埋め込む。出力要件(具体ステップで・順序立てて等)も書く。
2. **Workflow ツールを呼ぶ**（multi-agent orchestration なのでユーザーが明示的に依頼した時のみ＝この skill 発火自体が opt-in）。下記テンプレを `script` に渡す。
3. **Panel(並列3枚)**: ①Claude=実務家視点 ②Claude=懐疑/リスク視点 ③Codex=別モデル。各枚 `PANEL_SCHEMA`(answer/key_steps/assumptions/risks)で構造化。
4. **Judge(1枚)**: パネルJSONを読み、`JUDGE_SCHEMA`(consensus/contradictions/blind_spots/unique_insights)を抽出。多数決にしない。
5. **Synthesize(1枚)**: judge分析に基づき最終回答を執筆。矛盾は逃げず判断を下す／盲点を必ず1セクション入れる。
6. **結果を relay**: 「割れた論点」と「Codex独自洞察」を見せると Fusion らしさ(=合議の価値)が伝わる。最後に synth の最終回答。
7. 再利用: 起動時に返る `scriptPath` を控え、`QUESTION` だけ Edit して `Workflow({scriptPath, resumeFromRunId})` で別お題に流用。

### Codexパネル枚のプロンプト核（多様性の源）
リレー役にさせる。`timeout 300 codex exec --skip-git-repo-check "<QUESTION>" </dev/null` を実行→出力を PANEL_SCHEMA に構造化させる。`command not found` 時は full path `~/.nvm/versions/node/v<ver>/bin/codex` にフォールバック。失敗時は answer="CODEX_UNAVAILABLE" を返させ、judge側で除外。

### スクリプト骨子
```js
export const meta = { name:'self-fusion', description:'...', phases:[{title:'Panel'},{title:'Judge'},{title:'Synthesize'}] }
const QUESTION = `...前提と出力要件を全部埋める...`
phase('Panel')
const PANEL_SCHEMA = { type:'object', additionalProperties:false,
  properties:{ answer:{type:'string'}, key_steps:{type:'array',items:{type:'string'}},
    assumptions:{type:'array',items:{type:'string'}}, risks:{type:'array',items:{type:'string'}} },
  required:['answer','key_steps','assumptions','risks'] }
const panel = await parallel([
  ()=>agent(`実務家視点で…\n\n${QUESTION}`, {label:'panel:実務家', phase:'Panel', schema:PANEL_SCHEMA}),
  ()=>agent(`懐疑/リスク視点で…\n\n${QUESTION}`, {label:'panel:懐疑', phase:'Panel', schema:PANEL_SCHEMA}),
  ()=>agent(`あなたはリレー役。codex exec で別モデルに同じ問いを投げ忠実に構造化…`, {label:'panel:Codex', phase:'Panel', schema:PANEL_SCHEMA}),
])
const valid = panel.filter(Boolean)
phase('Judge')
const JUDGE_SCHEMA = { type:'object', additionalProperties:false,
  properties:{ consensus:{...}, contradictions:{...}, blind_spots:{...}, unique_insights:{...} },
  required:['consensus','contradictions','blind_spots','unique_insights'] }
const judge = await agent(`judge役。多数決でなく分解抽出…\n${JSON.stringify(valid,null,2)}`, {phase:'Judge', schema:JUDGE_SCHEMA})
phase('Synthesize')
const final = await agent(`synthesizer役。矛盾は判断を下し盲点を1節入れる…\n${JSON.stringify(judge)}\n${JSON.stringify(valid)}`, {phase:'Synthesize'})
return { panel_count: valid.length, judge, final }
```
（完全版は本セッションで生成した `self-fusion-wf_*.js` を参照。）

## Pitfalls

- **Workflow は明示 opt-in 必須**。ユーザーが「やって」と言った時だけ。勝手にfan-outしない。
- **Codex枚は遅い**（`codex exec` でシェルアウト、2-4分）。Workflow全体が5-6分かかる前提。背景実行(`run_in_background`既定)で待つ。
- **Codexが落ちてもOK**: `parallel` は失敗枚を null にするので `.filter(Boolean)`。judgeプロンプトで `CODEX_UNAVAILABLE` 除外を明示。3枚→2枚でも合議は成立。
- **多数決にさせない**: judgeに「分解して構造抽出。矛盾と盲点を出せ」と明記しないと、ただの要約になり Fusion の価値(=矛盾の可視化)が消える。
- **synthが矛盾から逃げる**: 「どちらを採るか判断を下せ」と強制しないと両論併記で終わる。盲点セクションも必須指定しないと省略される。
- **PANEL_SCHEMA に `additionalProperties:false` と `required`** を付けないと枚ごとに形がブレてjudgeが読みにくい。
- 有料の本家Fusionは「パネル全員+judge合計請求」。Quality(Opus+GPT+Gemini Pro)は1クエリ$0.5-3+。**この skill はその代替＝$0**。本家を使う理由は基本ない。

## Verification

- Workflow完了通知の `panel_count` が 2 以上（理想3）。0-1なら多様性が死んでるので Codex/PATH を点検。
- judge出力に `contradictions` が1件以上あること＝モデルが実際に割れた証拠。空なら問いが浅いか視点が被ってる(プロンプトの視点を分離し直す)。
- 実証済み(2026-06-15): お題「HP制作で最初の1件を取る」で 3/3回答・5分40秒・$0。Codexが「新規でなく送信済みリードへの追客が律速」という他2枚に無い独自診断を提供し、judge経由で最終回答に昇格した。
