---
name: reddit-itch-autopost-gotchas
description: 海外向け(英語圏)にプロダクトをReddit/itch.ioで宣伝自動化する時。Reddit APIアプリ作成が新規垢で弾かれる罠、itch HTML5の相対パス必須罠、butlerのサンドボックス到達不可、アンチBAN設計を扱う。
author: auto
created: 2026-06-22
version: 1.0.0
---

## Procedure

海外SNS自動投稿は **Reddit と itch.io で性質が全く違う**。役割分担を最初に固める。

- **itch.io = ゲーム/デジタル商品のホスティング**（SNSではない）。自動化できるのは `butler` でのビルド公開・更新のみ。HTML5(ブラウザ)ゲームだけ載る（iOSアプリは不可）。
- **Reddit = 本物のSNS**。PRAW(Python)でAPI投稿できるが、自己宣伝は規約とアンチスパムの両面でリスク最大。

### itch.io 全自動（butler）
1. butler入手は `https://broth.itch.ovh/butler/darwin-arm64/LATEST/archive/default`（arm64無ければ amd64）。⚠️Claude Bashサンドボックスからは `broth.itch.ovh` も `api.itch.io` も**到達不可**＝butler導入/pushは**ユーザーの実マシンで `!` 実行**させる。
2. **⚠️最重要罠：itchはHTMLゲームをサブパスiframeで配信するのでアセットは相対パス必須**。Vite既定は絶対パス`/assets/`→itchで**白画面**。itch用ビルドだけ `npx vite build --base=./` で相対化（Vercel側の `npm run build` は絶対のまま温存）。`dist/index.html` が `./assets/` `./art/` になり index.html がdist直下にあることを確認。
3. `butler push dist <user>/<game>:html-web` → 対象プロジェクトが無ければ**draft(非公開)で自動作成**＝勝手に世界公開されない。
4. ページ設定(kind=HTML / "play in browser"チェック / viewport / Public)は**APIが無くWeb UIのみ**。初回だけダッシュボード手動 or ブラウザ自動化。一度HTML公開にすれば以降の `butler push` は即ライブ更新で完全自動。

### Reddit
- **⚠️最重要罠：新規/低カルマアカウントはReddit側がAPIアプリ作成自体を拒否する**。`reddit.com/prefs/apps` でname/script/redirect uriを正しく埋めreCAPTCHAを緑✓にして create app しても、**フォームが真っ白にリセットされ作成されない**（"Approval is required"の実体）。入力ミスではない＝リトライ無駄。→ 歴/カルマのある別垢を使うか、垢を育てるまで全自動は不可。
- **Responsible Builder Policy**（reddit support記事 42728983564564）が自動宣伝を明示禁止：「automated posts で identical/substantially similar content across subreddits = spam」「mixed-use account禁止(個人垢をbot兼用するな)」「botはApp label登録必須」。違反enforcementは**アカウントだけでなく紐づくdomain/subredditもBAN**。全自動強行は宣伝ドメインごと焼けるリスク。
- 英語ドラフト生成だけなら `claude -p --model sonnet`(ローカル・無料・Reddit垢不要)でサブ別トーンの本文を作れる→手貼り運用が最も安全。

### アンチBAN設計（全自動を組むなら最低限）
- 1日1投稿上限・同一サブは7日空ける（substantially similarのスパム信号最小化）
- サブ別に min_account_age_days / min_comment_karma / min_link_karma を持ち**投稿前に適格判定**→通らないサブはスキップ（AutoModerator削除を回避）
- 投稿後に**未認証GET `permalink+".json"`** で removed_by_category を見てシャドウバン自動検知→死んでたら停止
- thread_only サブ（r/iOSProgramming等）はトップレベル投稿禁止＝週次スレにコメントのみ

## Pitfalls
- itch相対パス忘れ→白画面。`--base=./` を publish.sh のビルド手順に焼く。
- Reddit新規垢でアプリ作成が通らないのを「reCAPTCHA問題」と誤診して手順を往復させない。フォーム白紙リセット＝垢ゲート確定。
- Claudeサンドボックスは pypi/github/reddit.com/itch.io は到達するが `api.itch.io`/`broth.itch.ovh` は不可。butler系はユーザー実機 `!` 実行。
- 機密(itch APIキー/Reddit client_secret/password)は会話に貼らせない／.envはgitignore。会話ログがVaultに残るので貼られたらrotate推奨。

## Verification
- itch: `npx vite build --base=./` 後 `grep -oE '(src|href)="[^"]*assets[^"]*"' dist/index.html` が `./assets/` で始まる。
- Reddit垢ゲート: create app後にページ上部へapp boxが出たか。出なければ作成失敗＝この垢では不可。
- ドラフト生成: `python orchestrate.py --dry-run` が英語title/bodyをdrafts/に出力（claude -p不通ならテンプレfallback）。
