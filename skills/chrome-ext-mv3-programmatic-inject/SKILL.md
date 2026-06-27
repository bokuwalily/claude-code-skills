---
name: chrome-ext-mv3-programmatic-inject
description: Chrome拡張（Manifest V3）で popup から content script にメッセージを送ると "Could not establish connection. Receiving end does not exist." が出るとき。宣言的注入から programmatic 注入に切り替える手順。
author: auto
created: 2026-05-26
version: 1.2.0
status: active
disallowed-tools: Bash Write Edit Agent
---

## Procedure

### 1. `manifest.json` に `scripting` 権限を追加する

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "storage", "scripting"]
}
```

### 2. `content.js` の先頭に二重注入ガードを追加する

```js
if (window.__myExtLoaded) return;
window.__myExtLoaded = true;

// 本来のロジックはここから
```

### 3. `popup.js` で「注入してからメッセージ送信」の順序にする

```js
async function injectAndSend(tabId, message) {
  // content.js が他スクリプト(設定/ライブラリ)に依存する場合は
  // 依存を必ず先に、同じ files 配列で一緒に注入する（順序通りに実行される）。
  // ここを content.js 単独にすると「宣言注入が走っていないタブ」で
  // ReferenceError: X is not defined になり無言クラッシュする（下記 Pitfalls）。
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/settings.js', 'lib/license.js', 'lib/quota.js', 'content.js'],
  });

  // 注入後にメッセージ送信
  return chrome.tabs.sendMessage(tabId, message);
}

document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.match(/https:\/\/(x|twitter)\.com/)) return;
  await injectAndSend(tab.id, { type: 'START' });
});
```

### 4. `chrome://extensions` で拡張を更新（↻）して動作確認する

## Pitfalls

- **宣言的 `content_scripts` は「拡張インストール前に開いていたタブ」には自動注入されない**。ユーザーにタブリロードを求めるUXは避けられないため、programmatic 注入の方が UX 良好。
- **依存スクリプトの注入漏れ（最頻の罠）**: manifest の `content_scripts.js` が `["lib/a.js","lib/b.js","content.js"]` のように複数でも、popup からの programmatic 注入で `files:["content.js"]` だけにすると、宣言注入が一度も走っていないタブでは `lib/*` が未注入。宣言注入と programmatic 注入は同一 isolated world を共有するため通常タブでは生き残って動くが、当該タブだけ content.js が依存グローバル参照で即クラッシュ（`loop().catch()` 等で握り潰すと popup は「実行中」表示のまま無反応）。**programmatic 注入の files には宣言注入と同じ全ファイルを同順で入れる**こと。lib 側を IIFE(`root.X = ...` 再代入)にしておけば重複注入は冪等で安全。
- **`activeTab` は host_permissions があれば不要**: 固定ホスト権限（例 `https://www.instagram.com/*`）を持つ拡張では `activeTab` は何も追加しない。Web Store 審査の最小権限の観点で外してよい（`scripting`+`tabs`+host で programmatic 注入も tabs 操作も成立）。
- `chrome.scripting.executeScript` は `scripting` 権限がないと `Permission denied` で失敗する。manifest 更新後は必ず拡張を再読み込みする。
- 二重注入ガード（`window.__myExtLoaded`）がないと、同一タブで複数回注入するとイベントリスナーが重複登録される。
- `chrome.tabs.sendMessage` は非同期なのに `try/catch` なしだとコンソール警告が残る。必ず `try { ... } catch {}` でラップする。

## Verification

1. 対象タブのコンソール（DevTools → Console）を開く
2. popup の「開始」ボタンを押す
3. `[ExtName] content.js loaded on https://...` のログが表示されれば注入成功
4. `"Could not establish connection"` エラーが消えていることを確認する
