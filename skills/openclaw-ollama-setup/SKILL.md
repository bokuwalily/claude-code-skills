---
name: openclaw-ollama-setup
description: OpenClaw(2026.5+)をローカルOllamaのLLMで動かす設定をしたい時。プロバイダ登録・デフォルトモデル設定・動作検証まで。旧OpenAI互換ハックは不要
author: auto
created: 2026-06-11
version: 1.0.0
---

## Procedure

前提: `ollama serve` 稼働（`curl -s http://localhost:11434/api/tags` でUP確認）、モデルpull済み。

1. **ネイティブollamaアダプタを使う**（2026.5.7時点）。旧`openclaw_revival.sh`のOpenAI互換(`baseUrl:.../v1`+ダミーapiKey)は不要。`models.providers.<id>.api: "ollama"` が正規。

2. パッチファイルを書く（`~/.openclaw/openclaw.json` が無くてもpatchが作成する）:
```json5
{
  models: {
    mode: "merge",
    providers: {
      "ollama-local": {
        api: "ollama",
        baseUrl: "http://localhost:11434",   // /v1 は付けない
        models: [
          { id: "qwen2.5:14b", name: "Qwen2.5 14B (local)" },
          { id: "llama3.2:3b", name: "Llama3.2 3B (fast, local)" }
        ]
      }
    }
  },
  agents: { defaults: { model: "ollama-local/qwen2.5:14b" } }
}
```

3. 検証付き適用:
```bash
openclaw config patch --file /tmp/patch.json5 --dry-run   # 検証
openclaw config patch --file /tmp/patch.json5             # 適用
openclaw infer model providers | grep ollama             # configured:true,selected:true
openclaw infer model run --local --model "ollama-local/qwen2.5:14b" --prompt "test"
```

4. 対話利用: `openclaw chat`（= `tui --local`）。gateway側に反映するには再起動（`openclaw gateway` 系）。

## Pitfalls

- **`baseUrl` に `/v1` を付けない**。ネイティブ`ollama`アダプタは素の `http://localhost:11434`。`/v1`はOpenAI互換(`openai-completions`)アダプタ用。
- プロバイダidを `ollama` 単体にすると内蔵名と紛らわしい → `ollama-local` 等にして `<id>/<model>` で参照。
- モデル参照は必ず `provider/model` 形式（例 `ollama-local/qwen2.5:14b`）。
- gateway稼働中の設定変更は「Restart the gateway to apply」が出る。CLIワンショット(`infer model run --local`)は即反映。
- `api`の有効enum: openai-completions / openai-responses / anthropic-messages / google-generative-ai / github-copilot / bedrock-converse-stream / **ollama** / azure-openai-responses。

## Verification

`openclaw infer model run --local --model "ollama-local/qwen2.5:14b" --prompt "一言返して"` が実テキストを返せば成功（qwen2.5:14bで初回~12秒）。

## Memory連携（Claudeと同じ知識をOllama版OpenClawに持たせる）

OpenClawのmemory-coreでObsidian vault＋Claudeメモリを**ローカルollama埋め込み**でインデックスする（外部送信ゼロ）。

1. 埋め込みモデルをpull: `ollama pull nomic-embed-text`（無料・768次元）
2. `mkdir -p ~/.openclaw/workspace/memory`（無いとindexが"memory directory missing"で怒る）
3. patch適用:
```json5
{ agents: { defaults: { memorySearch: {
  enabled: true,
  provider: "ollama",            // 既定はopenai＝キー無で失敗するので必ず切替
  model: "nomic-embed-text",
  sources: ["memory", "sessions"], // sessions=過去会話もリコール対象
  extraPaths: [                    // ~展開されない→絶対パス必須
    "~/Documents/claude-obsidian/wiki",
    "~/.claude/projects/-Users-you/memory"
  ],
  sync: { onSessionStart: true, onSearch: true, watch: true } // 自動再index・cron不要
}}}}
```
4. index構築: `openclaw memory status --index --agent main`（"Embeddings: ready" / "Indexed: N/N"を確認）
5. 検証: `openclaw memory search "就活トラッカー" --agent main` で実ヒット確認

### Pitfalls（memory）
- 既定の埋め込みprovider=`openai`はAPIキー無しで失敗。`ollama`へ必ず変更。
- `extraPaths`は`~`非展開。絶対パスで書く。
- 設定後は `openclaw chat` を入り直さないと走行中セッションには効かない。

## チャット中リコール＋弱いローカルモデル対策（重要な実戦知見）

### `openclaw chat` はプラグインを積まない
`openclaw chat` = `tui --local` = **埋め込みモード＝プラグイン(active-memory等)非ロード**。プラグインのリコールを効かせるには **Gatewayを起動して `openclaw tui`（--local無し）で繋ぐ**。
- Gateway起動の前提: configに `gateway.mode:"local"`, `gateway.auth:{mode:"none"}`, `gateway.bind:"loopback"`（auth は文字列でなくオブジェクト）。`openclaw gateway --force` で常駐。

### qwen2.5:14bは丸腰にしないとエージェント機構で壊れる
ツール/スキルが多いと14Bは注入メモリを無視して `web_search`(要ollamaクラウド認証→失敗)/`skill_workshop`/`memory_retrieve` の生JSONを吐く。**必須**:
```json5
{ tools: { profile: "minimal", web: { search:{enabled:false}, x_search:{enabled:false} } },
  agents: { defaults: { skills: [] } } }
```
→ tool policyが23ツール除去。これで素直に答える。

### 確実なメモリ注入＝静的bootstrap（active-memory RActより信頼できる）
`~/.openclaw/workspace/USER.md`(と main セッションの `MEMORY.md`)は**埋め込み/Gateway両モードで毎ターン確実にプロンプト注入**される。ここにユーザーの核（プロフィール・主要プロジェクト・stack・応答方針）を書くのが最も確実。
- active-memory(RAGサブエージェント)は: llama3.2:3b=`no_relevant_memory`誤判定が出る／qwen2.5:14b=`timeout`(45s超)。**flakyなので主役にしない**。USER.md静的注入を baseline、active-memoryは Gateway時の上積みとして残す程度。
- `plugins.entries.active-memory.hooks.allowPromptInjection:true` を入れてもheadless `openclaw agent` ターンには `runtimeContextChars=0`(注入は主にライブ対話パス)。
- 深い長尾の事実は `openclaw memory search "..."`(CLI)で確実に引ける＝これは常に効く。

### 検証
`openclaw agent --local --session-key tNN --message "俺は誰？何作ってる人？"` → USER.mdの内容で正しく答えればbaseline成立。
