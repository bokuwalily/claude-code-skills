---
name: discord-bot-image-to-claude
description: 自作Discord gateway bot(claude -p 連携)で、Discordに貼った画像をClaudeに認識させたい時。添付をローカルDL→パスをプロンプトに添えてReadさせる。
author: auto
created: 2026-06-21
version: 1.0.0
---

## Procedure

`~/.discord/bridge.mjs` のような自作 Discord⇄claude bot は、既定で `m.content`(テキスト)
しか claude に渡さず、**画像添付(`m.attachments`)を無視**する。画像を認識させるには
添付をローカルに落とし、その**絶対パスをプロンプトに添えて claude の Read ツールに読ませる**。
(claude CLI はローカル画像ファイルを Read で読める。`allowed_tools` に `Read` が要る)

### 1. 画像DLヘルパー(依存ゼロ・Node24 fetch)
```js
const ATT_DIR = `${DDIR}/attachments`;
const isImageAtt = (a) =>
  (a.content_type || "").startsWith("image/") ||
  /\.(png|jpe?g|gif|webp)$/i.test(a.filename || "");

async function downloadImages(atts, msgId) {
  const imgs = (atts || []).filter(isImageAtt).slice(0, 8); // 最大8枚
  if (!imgs.length) return [];
  try { mkdirSync(ATT_DIR, { recursive: true }); } catch {}
  const paths = [];
  for (let i = 0; i < imgs.length; i++) {
    const a = imgs[i];
    try {
      const res = await fetch(a.url);                       // Discord CDNは認証不要
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const safe = (a.filename || `img${i}.png`).replace(/[^\w.\-]/g, "_");
      const p = `${ATT_DIR}/${msgId}_${i}_${safe}`;
      writeFileSync(p, buf); paths.push(p);
    } catch (e) { log("img dl fail", a.url, e?.message || e); }
  }
  return paths;
}
```

### 2. ハンドラ: テキスト無し画像のみも受理
```js
const text = (m.content || "").trim();
if (text.startsWith("//") || text.startsWith("#")) return;     // メモはスルー(画像付きでも)
const imgAtts = (m.attachments || []).filter(isImageAtt);
if (!text && imgAtts.length === 0) return;                     // 両方無ければ無視
```

### 3. プロンプト合成 → 実行 → finallyで後始末
```js
let imgPaths = [];
try {
  imgPaths = await downloadImages(imgAtts, m.id);
  let prompt = text;
  if (imgPaths.length) {
    const list = imgPaths.map((p) => `- ${p}`).join("\n");
    prompt = `${text}\n\n[添付画像 ${imgPaths.length}枚。Readツールで読み、内容を踏まえて応答せよ]\n${list}`.trim();
  }
  const res = await runClaude({ prompt, /* ...既存 */ });
  // ...
} finally {
  for (const p of imgPaths) { try { unlinkSync(p); } catch {} } // 一時画像を削除
}
```
import に `mkdirSync, unlinkSync` を追加。反映は `launchctl kickstart -k gui/$(id -u)/<label>`。

## Pitfalls
- `allowed_tools`(と壁打ちモードのRO_TOOLS)に `Read` が無いと claude が画像を開けない。両方確認。
- Discord添付URL(`a.url`)は署名付きで一時的。受信直後にDLする(後で取りに行くと失効)。
- 一時ファイルは `finally` で必ず削除。残すと `~/.discord/attachments/` が肥大する。
- 枚数上限(8)とファイル名サニタイズ(`[^\w.\-]→_`)は入れる。巨大/悪意ファイル名対策。
- このbotがRESUME再配信で二重処理する問題は別件 →  を併用。

## Verification
- `node --check bridge.mjs` で構文OK、再起動後ログに `READY as <bot>`。
- 画像1枚を該当chに貼る→ `▶️ 受付: 🖼 画像1枚`(テキスト無し時)が出て、claudeが内容に言及した応答を返す。
- 処理後 `ls ~/.discord/attachments/` が空(後始末されている)。
