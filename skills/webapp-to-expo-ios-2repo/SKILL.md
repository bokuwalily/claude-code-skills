---
name: webapp-to-expo-ios-2repo
description: 既存のNext.js+Turso Web SaaSをiOSネイティブアプリ化する時に発火。Webを本番API/cronとして維持し、別リポでExpo(SDK56)ネイティブクライアントを作る2リポ方式。shukatsu-tracker・postwingで実証済み。
author: auto
created: 2026-06-16
version: 1.1.0
---

## Procedure

Web(Next.js)は触らず本番維持し、ネイティブはAPIクライアントとして別リポに作る。テンプレ元=`~/dev/shukatsu-tracker-app`（実証済み Expo SDK56 雛形）。

### 1. Web側にモバイルJSON API(Bearer JWT)を生やす（feat/mobile-apiブランチ）
- 既存のセッション署名(jose/AUTH_SECRET)・許可リスト・検証関数を**再利用**。CookieでなくAuthorizationヘッダで運ぶだけ。
  - `lib/mobile-auth.ts`: `userIdFromBearer(req)` = `Authorization: Bearer` を既存 `verifySessionToken` で検証。
  - `lib/mobile-id-token.ts`: Google(`GOOGLE_MOBILE_CLIENT_ID`=iOSクライアント) / Apple(`APPLE_BUNDLE_ID`) の id_token を JWKS 検証。email_verified必須。
  - `lib/mobile-core.ts`: userId引数の読み書き関数群。timestampは epoch ms でシリアライズ。**全クエリ userId スコープ必須(IDOR防止)**。
  - `lib/api-error.ts`: JSONエラー封筒（詳細はログのみ）。
  - routes: `api/auth/mobile`(POST provider+idToken→{token})、`api/mobile/<resource>` の REST、`api/notifications/register`(Expoトークン)。
- **Next.js 16注意**: `node_modules/next/dist/docs/` を読む(AGENTS.md指示)。動的ルートは `{ params }: { params: Promise<{ id: string }> }` → `await params`。
- vitest: Bearer往復テスト(`createSessionToken`→`userIdFromBearer`)。
- DB: push通知トークン列など追加分はnullable列にして本番 `npm run db:push`(安全)。

### 2. Expoアプリを別リポにscaffold（テンプレ流用コピー）
- テンプレから流用コピー: `tsconfig*.json` `jest.config.js` `eas.json` 、`src/lib/{api,auth,auth-store,push}.ts`(ほぼ無改変)、`src/components/{Screen,Card,StateViews,themed-*}.tsx` `src/components/forms/{FormModal,Field,DateField,EnumPicker}.tsx` `src/constants/theme.ts` `src/hooks/*` `src/global.css`。
- `api.ts` のBASE = `Constants.expoConfig?.extra?.apiBaseUrl`。`auth.ts` = id_token→`/api/auth/mobile`→SecureStore保存。
- 新規実装: `app.config.ts`(name/slug/scheme/bundleId/extra.apiBaseUrl+googleIosClientId)、`src/app/{_layout,index,login}.tsx`、`src/app/(tabs)/*`、`src/lib/{queries,mutations}.ts`(react-query)、`src/types/api.ts`(WebのDTOと一致)。
- ログイン後遷移先・法務リンク(privacy/terms/contact)は本番ドメインに向ける。
- 検証: `npm install` → `npx tsc --noEmit` → `npx jest`(純粋ロジックのテスト) → `npx expo config`(設定解決確認)。
- オリジナルアイコンを sharp で生成(`scripts/gen-icons.mjs`、icon/splash/favicon/android各種)。CLAUDE.md必須。

### 3. 台帳・記憶
- `~/PROJECTS.md` の `03-ios-app` に追記 + `~/Desktop/All-Projects/03-ios-app/` に symlink。memory file 作成。

## Pitfalls
- **テンプレのapp固有値が残る**: `eas.json` の `ascAppId`、`app.config.ts` の Google逆引きクライアントID/EAS projectId は前アプリのもの。必ず差替/プレースホルダ化。
- **Web本番ドメイン混同**: postpilotの本番は postwing.vercel.app（postpilot.vercel.appは他人）。法務リンク・apiBaseUrlを誤らない。
- **node_modules/.env をコミットしない**: Expoの`.gitignore`を入れ、commit前に `git diff --cached --name-only | grep -E 'node_modules|\.env'` で0件確認。
- **DateFieldはISO文字列、DTOはepoch ms**: 境界で `new Date(ms).toISOString()` ⇔ `Date.parse(iso)` 変換。
- **Vercelのsensitive envは `vercel env pull` で空(`KEY=""`)になる**: TURSO_AUTH_TOKEN等は取れない。本番DBの列追加は `turso db shell <db> "ALTER TABLE ... ADD COLUMN ... "` で直叩き(nullable列は安全)。Google client IDの照合は GCP Console の値で。
- **`eas.json` にコメント用キーを足すと schema 検証で落ちる**(`"comment" is not allowed`)。メモはREADMEへ。
- **iOS署名クレデンシャルの再利用方針**: 配布証明書/APNsキー/ASC APIキーは**アカウント単位→既存を再利用(Y)**。プロビジョニングプロファイルは**bundle ID単位→新規アプリは生成(Y)**。
- **`eas submit` はASCアプリを自動作成**できる(ascAppIdをeas.jsonから外しておく→提出後に出た数字IDを固定)。Apple OAuthクライアントID/証明書は公開IDなのでログ表示OKだが、Apple ID/2FA入力は必ず本人。
- **`!`コマンドはセッションのcwd(既定`~`)で走る**: `eas`系は `cd ~/dev/<app> && eas ...` で。`eas`はnvm配下なのでグローバル`npm i -g eas-cli`済(`eas`で通る)。
- **EASは `npm ci --include=dev` で厳格インストール**: ローカル `npm ci`(npm 11)が通っても、推移依存(例 tentapの `@floating-ui/dom`)がlockに無いとEASだけ "out of sync" で「Install dependencies」失敗。ネイティブ依存追加後は **`rm -rf node_modules package-lock.json && npm install`** でlock再生成→`npm ci`で検証→commit。`sharp`等のdevDepはアプリビルドに不要なら外す(無関係なバイナリでハマらない)。
- **EASビルド失敗ログの取得**: `eas build:view <id> --json` の error は要約のみ。実ログ＝ `curl https://api.expo.dev/graphql -H "expo-session: <~/.expo/state.jsonのsessionSecret>" -d '{"query":"query($id:ID!){builds{byId(buildId:$id){logFiles}}}","variables":{"id":"<id>"}}'` でGCS署名URL取得→DLして **brotli展開**(`node -e "process.stdout.write(require('zlib').brotliDecompressSync(require('fs').readFileSync(f)))"`)。NDJSONで phase=INSTALL_DEPENDENCIES の stderr に npm エラーが出る。
- **`eas submit` はASCアプリ自動作成＋ascAppId固定後は非対話**: 2回目以降は `eas submit -p ios --latest --non-interactive`(ASC APIキー・cert・push key はアカウント共用でキャッシュ済)。`eas build` も credential既存なら `--non-interactive` でClaude単独実行可。
- **ビルド＋提出ワンショット**: `cd ~/dev/<app> && CI=1 eas build --platform ios --profile production --auto-submit --non-interactive`。`--auto-submit`はビルド完了後にサーバ側で提出を予約→CLIはbuild完了まで待って提出も実行。**`run_in_background:true`で投入**(15-20分・プロセスを生かしたままupload→build→submitを通す)。`CI=1`でスピナーJSON汚染を防ぐ。
- **⚠️再提出は `expo.version` 上げ必須**: 同じ`version`(CFBundleShortVersionString)で2本目を出すとビルドは成功するが提出が `You've already submitted this version of the app` でApple拒否(ビルド番号autoIncrementしてもダメ)。`app.config.ts`の`version`を1.0.0→1.0.1へ上げて再ビルド。輸出コンプラ質問は`infoPlist.ITSAppUsesNonExemptEncryption:false`設定で手動回答不要(TestFlightで止まらない)。
- **⚠️ITMS-90189 build番号重複は`appVersionSource:"remote"`×ローカルビルドが原因**: eas.json `cli.appVersionSource:"remote"` だと(a)`ios.buildNumber`が無視され(b)`eas build --local`時にautoIncrementが強制false化(Expo公式 remoteVersionSource.ts/build.ts: `localAutoIncrement: REMOTE ? false : ...`)→ローカルビルド運用ではbuild番号が増えず再利用→`Redundant Binary Upload`。**ローカルビルド主体なら`appVersionSource:"local"`にし、`app.config.ts`で`version`+`ios.buildNumber`を明示管理**(動的TS configはautoIncrement書き戻し不可なので手動・git可視)。新versionはbuildNumber"1"開始。`npx expo config --type public | grep -E "version:|buildNumber"`で解決値を確認。
- **⚠️Guideline 5.1.1(v): アカウント作成があれば削除導線が必須**: サインインできるアプリは「アカウント削除」をアプリ内に置かないと却下。一時停止/無効化では不可。実装=API側に `DELETE /api/<...>/account`(Bearer本人のみ・関連行をFK依存順にトランザクション物理削除・userIdスコープ)＋アプリ設定に確認アラート付き削除導線→トークン破棄→login。再提出時はApp Reviewに**実機画面収録(サインイン→削除導線→確認→完了)をNotes欄添付**。
- **⚠️このハーネスのBash stdout混線で誤完了報告の罠**: 日本語/長文/プログレスバー混在でstdoutが崩れ、未コミット・未投入を「提出完了」と誤認しやすい。**判定は必ず①ファイル経由Read(`cmd > /tmp/x; Read /tmp/x`)②`eas build:list --platform ios --json --non-interactive`の実status③`git log`/`git status`の実体**で裏取り。ログに「Submitted your app to Apple」が出るまで提出成功と言わない。
- **EASビルドはコミット済みファイルを使う**: 作業ツリーの編集は`git add && git commit`してからビルド(未コミットだと旧UIがビルドされる)。commit-msg hookでtype必須(style/chore等)。
- **`experiments.typedRoutes:true`で新規ルート追加直後はtscが落ちる**: `router.replace("/onboarding")`等が `.expo/types/router.d.ts` 未更新で型エラー。型再生成は**`npx expo start`を一瞬起動**(`.expo/types/router.d.ts`にルート名が出たらpkill)で行う。`expo export`では型は再生成されない(バンドル検証用)。
- **`expo-store-review`はApp Store配信ビルドのみ実表示**: `StoreReview.requestReview()`はTestFlight/開発では無音(Apple仕様)。`await StoreReview.hasAction()`でガードし、レビュー失敗でオンボーディングを止めない。インストール後初回のみ出す制御はSecureStoreフラグ(`onboarding_done_v1`)で。

## Verification
- Web: `npx tsc --noEmit` 無出力 + `npx vitest run` 全緑。
- App: `npx tsc --noEmit` exit0 + `npx jest` 全緑 + `npx expo config` がエラーなく解決。
- リリースは手動ゲート(Google Cloud OAuth / 本番env / db:push / eas build / ASC作成+submit)で止め、「ライブ確認まで完了と言わない」。
