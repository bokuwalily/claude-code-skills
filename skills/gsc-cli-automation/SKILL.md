---
name: gsc-cli-automation
description: Google Search Consoleをコマンドで操作したい時（サイトマップ送信・検索パフォーマンス取得・URLインデックス状態の検査）。サービスアカウントが弾かれる時のADC(ユーザー認証)フォールバック手順込み。
author: auto
created: 2026-06-11
version: 1.0.0
---

# GSC をCLIで操作（googleapis + ADC）

ツール実体: `~/gsc-automation/gsc.mjs`（）。新規セットアップ時の手順。

## Procedure

1. 前提: `gcloud`（`brew install --cask google-cloud-sdk`）、node、`googleapis`。
2. GCPプロジェクト作成＋Search Console API有効化:
   ```bash
   gcloud auth login                              # ブラウザ同意(ユーザー)
   PID="gsc-auto-$RANDOM$RANDOM"
   gcloud projects create "$PID" --name="GSC Automation"
   gcloud config set project "$PID"
   gcloud services enable searchconsole.googleapis.com
   ```
3. **認証はADC(ユーザー)が確実**（本人が全プロパティ所有なら）:
   ```bash
   gcloud auth application-default login \
     --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters
   gcloud auth application-default set-quota-project "$PID"
   ```
   googleapis 側は `new google.auth.GoogleAuth({ scopes:['.../webmasters'] })`（keyFile無し）でADCを自動使用。
4. 動作確認: `node gsc.mjs sites` で所有プロパティが出れば成功。
5. `node gsc.mjs sync`（config.jsonの全sitemap送信）/ `report` / `inspect` を利用。

## Pitfalls
- **サービスアカウント方式はGSCの「ユーザー追加」がSAメールを弾く事がある**（"メールアドレスが見つかりませんでした"）。作りたて伝播遅延もあるが、本人所有なら**ADCユーザー認証の方が確実**で各プロパティへのSA追加作業も不要。
- ADCは quota project 未設定だとAPIが quota エラー→`set-quota-project` 必須。
- `gcloud iam service-accounts keys create` はSA作成直後だとNOT_FOUND（伝播待ち8秒で再試行）。
- **Indexing APIで一般ページのインデックス強制は禁止**（求人/動画限定・スパム判定）。やれるのはsitemap送信＋クロール待ち＋URL検査(読み取り)。
- siteUrl はURLプレフィックス型なら末尾スラッシュ必須。
- GSC未登録プロパティはAPI操作不可（"sufficient permission"エラー）→先にプロパティ追加＋所有権確認(HTMLファイル方式が楽)。
- 秘密: SAキー/ADC credentialは絶対コミットしない。`~/.config/` 配下・chmod 600。

## Verification
`node gsc.mjs sites` で siteOwner 表示。`inspect <site> <page>` で `coverage=Submitted and indexed` ならインデックス済確認。
