---
name: git-prepush-secret-remote-check
description: git pushやパブリック公開の直前に実行する。リモートURLが自分のリポジトリを指しているか確認し、ステージ・差分内のAPIキー/トークン/PII漏洩をスキャンする。複数セッションで「サードパーティforkへのwrong-remote」と「PII流出」が実際に発生したことへの対策。
author: auto
created: 2026-06-16
version: 1.0.0
status: active
---

## Procedure

### 1. リモートURLを確認する

```bash
git remote -v
```

出力例：

```
origin  git@github.com:YOUR_USERNAME/YOUR_REPO.git (fetch)
origin  git@github.com:YOUR_USERNAME/YOUR_REPO.git (push)
```

**自分のアカウント名が含まれていること**を確認。サードパーティのfork元URLになっていれば即修正：

```bash
git remote set-url origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
```

### 2. ステージ済みファイルに秘密情報がないかスキャン

```bash
git diff --cached | grep -iE \
  "(api_?key|secret|token|password|passwd|auth|credential|access_?key|private_?key)\s*[=:]\s*\S+"
```

何も出力されなければOK。ヒットしたら即 `git reset HEAD <file>` でアンステージし、`.env` 化してから `.gitignore` に追加。

### 3. コミット済み履歴を含むスキャン（念のため）

```bash
git log --oneline -10
git show HEAD | grep -iE "(api_?key|secret|token|password)\s*[=:]\s*\S+"
```

### 4. `.env` 系ファイルが追跡されていないか確認

```bash
git ls-files | grep -E "^\.env"
```

出力があればトラッキングから除外：

```bash
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
```

### 5. 個人情報（PII）の簡易チェック

```bash
git diff --cached | grep -iE \
  "(\b[0-9]{3}-[0-9]{4}-[0-9]{4}\b|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})"
```

電話番号・メールアドレスパターンにヒットしたらコード内のハードコーディングを確認。

---

## Pitfalls

- **fork元リモートのままpush**：テンプレートをforkしたまま `origin` を変えずにpushすると、サードパーティリポジトリに自分のコードが公開される。手順1を必ず行う。
- **`.env` ファイルの誤コミット**：`create-next-app` や `vite` はデフォルトで `.env.local` を `.gitignore` に入れるが、自前設定のプロジェクトでは漏れる。手順4で確認。
- **`grep` のパターンは完璧ではない**：難読化・Base64化された秘密情報は検出できない。`gitleaks` や `truffleHog` などの専用ツールが使える環境ならそちらを優先。
- **force-pushで履歴書き換えても残る**：一度でも公開リポジトリにpushしたシークレットはGitHub側にキャッシュされる可能性がある。露出したら即ローテーション。

---

## Verification

```bash
# リモートが自分のリポジトリを指していること
git remote -v | grep "YOUR_USERNAME"

# シークレットスキャンで何もヒットしないこと
git diff --cached | grep -iE "(api_?key|secret|token|password)\s*[=:]\s*\S+" | wc -l
# → 0 であればOK

# .env系が追跡されていないこと
git ls-files | grep -E "^\.env" | wc -l
# → 0 であればOK
```
