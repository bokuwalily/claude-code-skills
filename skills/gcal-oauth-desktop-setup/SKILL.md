---
name: gcal-oauth-desktop-setup
description: 個人GCPプロジェクトでGoogle Calendar APIのOAuth 2.0 Desktop App認証を新規セットアップするとき（既存GCPプロジェクトへの権限がない場合を含む）。
author: auto
created: 2026-05-26
version: 1.1.0
status: active
disallowed-tools: Agent
disable-model-invocation: true
---

## Procedure

### 1. 個人GCPプロジェクトを作成する

1. https://console.cloud.google.com/projectcreate を開く（対象Googleアカウントでログイン）
2. プロジェクト名を入力（例: `personal-gcal`）→「作成」
3. 上部プロジェクトセレクタで新規プロジェクトに切り替える

### 2. Calendar API を有効化する

1. https://console.cloud.google.com/apis/library/calendar-json.googleapis.com を開く（プロジェクトが正しいか確認）
2. 「有効にする」をクリック

### 3. OAuth同意画面を設定する

1. https://console.cloud.google.com/apis/credentials/consent を開く
2. User Type: **「外部」** → 「作成」
3. 必須項目を入力：
   - アプリ名（例: `gcal-cli`）
   - ユーザーサポートメール（自分のGmailアドレス）
   - デベロッパー連絡先（同上）
4. 「保存して次へ」→ スコープ画面では何も追加せず「保存して次へ」
5. テストユーザー画面で「+ ADD USERS」→ 自分のGmailアドレスを追加 → 「保存して次へ」

### 4. OAuth 2.0 クライアントID（Desktop App）を作成する

1. https://console.cloud.google.com/apis/credentials を開く
2. 「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類: **「デスクトップ アプリ」**
4. 名前を入力（例: `gcal-cli-desktop`）→「作成」
5. 「JSONをダウンロード」して安全な場所に保存（例: `~/.config/gcal/credentials.json`）

### 5. 依存パッケージをインストールする

```sh
pip install google-auth-oauthlib google-api-python-client
```

### 6. Pythonスクリプトで初回認証する

```python
import json, os
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/calendar']
CREDS_FILE = os.path.expanduser('~/.config/gcal/credentials.json')
TOKEN_FILE = os.path.expanduser('~/.config/gcal/token.json')

def get_service():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())
    return build('calendar', 'v3', credentials=creds)
```

初回実行時にブラウザが開き、Googleアカウントで認証する。以降はトークンが自動リフレッシュされ、ブラウザ不要。

## Pitfalls

- **既存GCPプロジェクト（他プロジェクト所有）は流用しない**。権限エラーになる。個人用は必ず個人所有プロジェクトを作る。
- OAuth同意画面のUser Typeを「内部」にすると Workspace 組織が必要。個人Gmailなら必ず「外部」を選ぶ。
- テストユーザーに自分のアドレスを追加しないと `access_denied` になる（公開ステータスにしない限り）。
- `credentials.json` はシークレット扱い。`.gitignore` に必ず追加し、絶対にコミットしない。
- トークンの保存は `creds.to_json()` + `Credentials.from_authorized_user_file()` を使う。`pickle` は使わない（任意コード実行リスク）。

## Verification

```sh
python3 gcal.py
# → ブラウザ認証後（初回のみ）、カレンダー一覧やイベント追加が成功すれば完了
```

以降は `token.json` が存在する限りブラウザ起動なしでバックグラウンド実行できる。
