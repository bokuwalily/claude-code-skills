---
name: codesign-keychain-prompt-fix
description: fastlane/xcodebuild の iOS署名中に codesign のキーチェーン許可ダイアログ（「codesignがキー…へアクセスしようとしています」）が出る・固まって消えない時。特に複数ビルド同時実行でダイアログが競合してハングした時に発火。
author: auto
created: 2026-06-17
version: 1.0.0
---

## Procedure

### 症状
- iOSアーカイブ署名中、`codesign` が login キーチェーンの秘密鍵にアクセスするため許可ダイアログを出す
- 「許可」だと毎回出る。複数ビルド（例: Konomi と Dayleaf）が**同時に署名**すると SecurityAgent が競合してダイアログが固まり消えなくなる

### 1. 状況把握
```bash
ps aux | grep -iE 'SecurityAgent|codesign|fastlane|xcodebuild' | grep -v grep
```
同時に走ってる署名系プロセスと、固まった SecurityAgent（`/System/.../SecurityAgent.bundle/.../SecurityAgent`）の PID を特定。

### 2. 固まったダイアログを消す
SecurityAgent は `killall` の SIGTERM を無視するので SIGKILL:
```bash
kill -9 <SecurityAgentのPID>
```
（必要時にOSが自動再起動する安全なプロセス）

### 3. 根本対処（再プロンプトを止める）= 本命
署名鍵のパーティションリストに codesign を一括登録。**ユーザー本人がログインパスワードで実行**（自分は password を打たない）:
```bash
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "<ログインパスワード>" ~/Library/Keychains/login.keychain-db
```
成功すると**変更した鍵の属性一覧をダンプして返す**（エラーなし＝成功）。`Apple Distribution`/`Imported Private Key`/`Apple Development` 系が列挙されていればOK。
- `-k "..."` を省けば一度だけGUIで聞かれる。

### 4. 宙ぶらりんのビルドを掃除して再実行
固まった codesign/xcodebuild/fastlane はツリーごと `kill -TERM`。残ってよいのは `com.apple.CodeSigningHelper`（OS常駐）のみ。その後、各ビルドを再実行。

## Pitfalls
- **computer-use では固まったダイアログを操作できない**：SecurityAgent は許可外アプリなので screenshot に映らず、クリックも届かない → コマンドで殺すのが正解
- `killall SecurityAgent` は効かない（SIGTERM無視）→ 必ず `kill -9`
- パーティションリスト未設定のまま「許可」を押し続けると鍵ごと・プロセスごとに延々出る。`set-key-partition-list` が唯一の恒久解
- **同時複数署名ビルドが競合の根本原因**。パーティションリスト設定後は同時でも衝突しないが、設定前は1本ずつ
- ログインパスワードはこちらに保存しない。スクロールバックが気になるなら `clear`

## Verification
- `set-key-partition-list` がエラーなく鍵一覧をダンプ
- `ps aux | grep -iE 'codesign|fastlane|xcodebuild'` が CodeSigningHelper 以外クリア
- 再ビルドで署名ポップが出ずに通る
