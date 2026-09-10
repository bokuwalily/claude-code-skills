---
name: asc-api-app-store-submit
description: iOSアプリをApp Store Connectへ「審査提出・状態確認・著作権/価格/メタの編集」する時。Appleログインや2FA無しで、保管済みのASC APIキー(JWT認証)を使って無人で操作する。eas submit後に審査まで通したい時、提出が止まった時、提出状態を確認したい時に発火。
author: auto
created: 2026-06-19
version: 1.1.0
---

## Procedure

App Store Connectには「人がWeb画面で操作」と「ASC APIキー(JWT)でプログラム操作」の2経路がある。後者は **2FA不要・無人** で、ビルド/メタ/価格/審査提出まで叩ける。鍵がこのMacに保管済み＝Claudeが自分で審査提出できる。

### 認証情報（このMacに保管済み・アカウント横断）
- `~/.appstoreconnect/keys.json` … key_id / issuer_id / key_path / team を持つ（**ここを読む。値をハードコードしない**）
- `~/.appstoreconnect/private_keys/AuthKey_*.p8` … 唯一の秘密（chmod 600・dir 700・gitリポ外）
- 1本でアカウント内の全アプリに有効（shukatsu/konomi/postwing/dayleaf 等）

### 再利用ヘルパー `~/.appstoreconnect/asc.py`
```bash
python3 ~/.appstoreconnect/asc.py apps                          # 全アプリ(id/bundleId/名前)
python3 ~/.appstoreconnect/asc.py status <app_id>              # version state/copyright/review/build
python3 ~/.appstoreconnect/asc.py set-copyright <app_id> "2026 Lily"
python3 ~/.appstoreconnect/asc.py submit <app_id>             # 編集中バージョンを審査提出
python3 ~/.appstoreconnect/asc.py add-tester <app_id>        # TestFlightテスター追加(既定=本人iCloud)
```
keys.jsonを読んでJWTを生成し直叩きする。`status`で `appStoreState` と `reviewSubmission.state` を確認できる。

### フルパイプライン（新規/更新アプリを審査まで）
1. **ビルド**: `eas build --local -p ios --profile production`（無料署名。`credentials.json`＋リポのAppStore profile。skill [expo-free-local-ios-testflight]）
2. **バイナリ上传**: `eas submit -p ios --path build/<app>.ipa --non-interactive`（EASサーバ保管のASCキーで2FA無し）
3. **メタ/スクショ**: `fastlane deliver`（Deliverfile・`fastlane/metadata`＋`fastlane/screenshots`）。スクショは 1320x2868(6.9") 必須・6.5"も入れると無難
4. **価格**: 未設定だと提出が止まる → Apple公式API `POST /v1/appPriceSchedules`（USA/USD/free等）。**fastlaneの旧price_tier経路は壊れてて使えない**
5. **公開フィールドの本人性**: copyright等は本名でなく「Lily」に（公開ポリシー）。`asc.py set-copyright`
6. **審査提出**: `asc.py submit <app_id>` か `fastlane deliver submit_build`
7. **TestFlightテスター追加(新規アプリは既定で必須)**: `asc.py add-tester <app_id>`。既定で本人 iCloud `you@example.com` を**内部グループ**(Beta審査不要=本人が即インストール可)へ追加。内部グループが無ければ `POST /v1/betaGroups`(`isInternalGroup:true` はAPIで設定可)で自動作成。今まで手動で全アプリに入れていた手間を自動化。冪等(`filter[apps]`で既存検出してskip)。別のテスターは `add-tester <id> <email>`。
   - ⚠️**唯一通る経路 = `POST /v1/betaTesters`(attributes.email + `relationships.betaGroups`で内部グループ指定)**。`POST /v1/betaGroups/{gid}/relationships/betaTesters` に既存テスターidを直リンクすると **409 STATE_ERROR "Tester(s) cannot be assigned"**(グローバルなbetaTester記録は外部用の名寄せで内部グループに付かない)。外部グループはビルドのBeta審査承認が無いとテスター追加不可で即時用途に使えない。createパスはemailで内部適格な記録に名寄せして付く。既に所属なら createパスも 409 を返す→`filter[apps]`で実在を再確認して成否を判定する。

## Pitfalls

- **本名漏れ**: App Storeのcopyright欄は公開。`fastlane/metadata/copyright.txt` がデフォルト本名になりがち → 「2026 Lily」に。提出済みでも `WAITING_FOR_REVIEW` 中はAPIでPATCH可（`In Review`でロック）。
- **PII**: `fastlane/Deliverfile` に Apple ID メールが入る → `.gitignore` 必須（リポ外）。`.p8`も当然gitignore。
- **価格未設定で提出停止**: fastlane price_tierは死んでる。公式API `appPriceSchedules` 直叩きで解決。
- **JWT**: ES256・`iss`=issuer_id・`aud`="appstoreconnect-v1"・exp 20分以内。`cryptography`でECDSA署名→r||s(各32byte)にrawエンコード（DERのままはNG）。
- **キーの場所**: Downloads等の揮発場所に置かない。`~/.appstoreconnect/`(700)に集約済。新しい鍵を貰ったら keys.json を更新するだけ。
- **eas submit のキー**はEASサーバ保管(別ID)。`asc.py`のキー(ローカル)とは別物だが両方同アカウント。
- **ITMS-90111 (beta macOSビルドが真因・2026-06-26 ねむログ/Konomiで確定)**: 提出が `ITMS-90111「Unsupported SDK or Xcode version - use latest RC」` で却下され version が直後に `INVALID_BINARY` 転落する時、**エラー文言はミスリードで真因は beta macOS でビルドした事**。アーカイブの `BuildMachineOSBuild` にbeta値(例 `26A5368g`=macOS27beta)が埋まり、Apple検証が拒否。最新安定版Xcodeでも落ちる(=ツールチェーンが原因に見えるが違う)。**ニュース/フォーラムが無い=Apple全体障害でなく自分の環境を疑え**。回避: アーカイブの `.app/Info.plist`(と全`PlugIns/*.appex/Info.plist`)の `BuildMachineOSBuild` を安定版macOSビルド番号(例 `25F80`=macOS26.5.1、都度確認)に `PlistBuddy -c "Set"` で書換え→ `xcodebuild -exportArchive`(再署名がパッチ済plistに乗る)→ IPAで値と `codesign --verify --deep --strict` を検証→ altool upload。提出後 **3-4分 WAITING_FOR_REVIEW 維持=成功**(失敗は1-2分でINVALID_BINARY)。詳細=memory `reference_itms90111_beta_macos`。なお Expo/RN は Xcode beta で `node_modules/*/.DerivedData` が汚染され安定版でもビルド不能になる→該当 `.DerivedData` を rm して再ビルド。
- **価格(無料)スケジュールPOSTの正解形(2026-06-22 つづけで確定)**: `POST /v1/appPriceSchedules`、`data.relationships`={app, baseTerritory(territories/USA・必須), manualPrices→[{type:"appPrices",id:"${p}"}]}、`included`=[{type:"appPrices",id:"${p}",**"attributes":{}**,relationships:{appPricePoint:{data:{type:"appPricePoints",id:<free>}}}}]。⚠️**includedのappPriceに`"attributes":{}`(空オブジェクト)が無い/`startDate:null`だと `422 invalid value at data.included`**。manualPricesに`appPricePoints`型を直入れすると409。価格ポイント=`/v1/apps/{id}/appPricePoints?filter[territory]=USA`でcustomerPrice=="0.0"(そのトークンidの直GETは404でも提出には有効)。

## Verification

- `python3 ~/.appstoreconnect/asc.py status <app_id>` で `appStoreState=WAITING_FOR_REVIEW` と狙いの copyright を確認
- PATCH/submitは戻りHTTP<400かつ再GETで反映を確認（推測で「提出済み」と言わない）
- 実績: 2026-06-19 konomi(6780963389) build13 を本パイプラインで審査提出・copyrightを本名→「2026 Lily」にPATCH(200)・`WAITING_FOR_REVIEW`をAPIで裏取り済
- 実績: 2026-06-21 5本(就活/PostWing/Konomi/30H/Dayleaf)を最新UIスクショ＋掲載文込みで一括審査提出。下記の罠を全部踏んで突破。

## 5本同時提出で踏んだ罠 (2026-06-21・再発防止)

- **審査待ちの差し替え**: WAITING_FOR_REVIEW のまま新ビルドは載せられない。先に `asc.py reject <id>`(保留submission取消)→`make-version`で新版→attach→submit。
  - ⚠️**`attach-build <app_id> <ARG>` の ARG は build番号でなく marketing version("1.0.0")**(2026-06-22 Akari build4で確定)。内部の`_build_for_version`は preReleaseVersion.version(=CFBundleShortVersionString)でマッチし、同 marketing の最新VALID buildを選ぶ。build番号(`4`)を渡すと `no VALID build for version 4` で永遠に空振り。正しい差し替え全手順: `reject <id>` → `attach-build <id> 1.0.0` → `submit <id>` → `status`で attached build番号と WAITING_FOR_REVIEW を裏取り。
  - 同 version で build番号だけ上げる更新(build3→4)は `make-version` 不要(既存編集中versionにattachするだけ)。CURRENT_PROJECT_VERSION を project.yml で上げ `xcodegen generate`(pbxprojに焼く)→archive→export→altool→VALID待ち→上記差し替え。
- **公開中(READY_FOR_SALE)の更新**: ASCの現行versionより上の番号必須。configが古い値でもASC側が先行している(例: 就活configは1.0.5だがASC公開は1.2)→必ず `asc.py status` で現行を見てから上の番号に。
- **Expo prebuildのバージョン焼き込み**: app.config の version bump *前* に `expo prebuild` するとios/に旧版が焼かれ、altoolが `CFBundleShortVersionString must be higher / train closed (90062/90186)` で蹴る。直し=`/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString X" ios/<App>/Info.plist`＋CFBundleVersionも。bumpは prebuild より前に。
- **dual-cert＋capability署名**(EAS無料クラウド枠切れ時): `eas build --local` は EAS管理プロファイルがローカル鍵の無いcertを指して `profile doesn't include signing certificate` で死ぬ。回避=ネイティブ流の fastlane ローカル署名。Expoの prebuilt `ios/<App>.xcworkspace`(scheme=`app`/`PostWing`等) に対し最小Fastfile: `get_certificates(development:false)`＋`get_provisioning_profile(force:true)`＋`build_app(... xcargs: "... PROVISIONING_PROFILE_SPECIFIER='#{lane_context[SharedValues::SIGH_NAME]}'")`。**xcargs に PROVISIONING_PROFILE_SPECIFIER を入れ忘れると archive で `requires a provisioning profile with Push/Sign In with Apple` になる**(Bundle IDにcapabilityはあるのにprofile未指定で自動署名が外す)。
- **fastlane deliver の api_key**: `--api_key_path` の JSON は `key`(=.p8本体テキスト) が必須。`key_filepath` だけだと `missing field(s): key`。一時JSONを `{"key_id","issuer_id","key":<p8文字列>,"in_house":false}` で作る(600・使い終わったら消す)。
- **deliver スクショ**: `sync_screenshots:true` は `FASTLANE_ENABLE_BETA_DELIVER_SYNC_SCREENSHOTS` 要求で止まる→ `overwrite_screenshots:true` のみ(syncは付けない)。初版は release_notes がスキップされる(whatsNew 409=初回は不要)。更新版は `asc.py whatsnew` 可。
- **altool 空パス**: `-f "$IPA"` の変数が空だと `File does not exist at path: .` で ExitFailure 31。**必ず絶対パスで渡す**。`fastlane build_app` の出力は プロジェクト直下 `<scheme>.ipa`。
- **提出409 (localization invalid)**: 追加ロケール(ko/en-US)に **サポートURL or スクショが無い** と `appStoreVersionLocalizations ... not in valid state`。直し=各ロケールに supportUrl をPATCH＋スクショを全ロケールへ配置して deliver。スクショ assetDeliveryState は全 `COMPLETE` を確認してから submit(アップロード途中で submit すると appScreenshots invalid)。
- 検証: `GET /v1/builds?filter[app]=<id>&fields[builds]=version,processingState` で `VALID` を待ってから attach。

## 追補: 新規ネイティブiOSアプリを“箱作成〜審査提出”まで無人で出す (2026-06-22 Auralyで全実証)

新規アプリは APIキーだけでは作れない/落とし穴が多い。実証済みの順序:

1. **箱(App record)作成**: `POST /v1/apps` はAPIキーで **403 (CREATE不可)**。正解=**`fastlane produce`**。Fastfileで `app_store_connect_api_key`(asc_key) → `produce(app_identifier:, app_name:, language:"Japanese", sku:, team_id:, skip_devcenter:true)`。Appfileに `apple_id` を置く。spaceshipセッションが無効でも **APIキーにフォールバックしてパスワード/2FA無しで作成**できる。
2. 署名/archive/altoolアップロード/VALID待ちは本文どおり。
3. **スクショは deliver、ただしスクショ単独で**: `fastlane deliver --skip_binary_upload true --skip_metadata true --skip_screenshots false`。⚠️metadataを同時にやると `review_attachment_file` で **クラッシュ(No data)**。
   - 🛑**deliver後・submit前に必ず `python3 ~/.appstoreconnect/asc.py dedup <app_id> --apply` を実行する(必須・任意ではない)**。`overwrite_screenshots:true`(syncなし)はリトライ時に既存を消さず**追記**するため、deliverが2回走ると各スクショが連続2枚に二重化する(同 checksum+fileName)。ストアで「同じ写真が2枚ずつ並ぶ」醜い表示になる。dedupは同一 checksum+fileName の2枚目以降を `DELETE /v1/appScreenshots/{id}` で間引く(編集中versionのみ可)。`--apply`無しはdry-run。2026-06-22に6アプリ(つづけ/就活トラッカー/PostWing/Dayleaf/30H/Konomi)で全滅し一括修正した再発防止。
   - 公開中(READY_FOR_SALE)アプリの修正は新version作成→継承スクショをdedup→新ビルド添付→submit。⚠️公開中versionは `DELETE` が 409(STATE_ERROR)。審査中(WAITING_FOR_REVIEW)は `asc.py reject` で DEVELOPER_REJECTED にしてから dedup→submit。
4. **メタ/著作権/ビルド添付/価格/年齢/審査連絡先は `asc.py` の `call()` をimportして直叩き**:
   - localization PATCH、version PATCH(copyright + relationships.build)。
   - 無料価格: `GET /v1/apps/{id}/appPricePoints?filter[territory]=USA` で customerPrice "0.0" の point → `POST /v1/appPriceSchedules`(included appPrice id `${price-0}` が free point を指す)。
   - 年齢4+: `PATCH /v1/ageRatingDeclarations/{id}`。⚠️**型混在**。enum"NONE"= violence*/sexual*/contests/gunsOrOtherWeapons/alcohol/gamblingSimulated/horror/mature/medical/profanity。**BOOLEAN(false)**= advertising/messagingAndChat/gambling/lootBox/unrestrictedWebAccess/healthOrWellnessTopics/parentalControls/userGeneratedContent/ageAssurance。kidsAgeBand=null。
   - 審査連絡先: `POST /v1/appStoreReviewDetails`。**contactPhone必須**(`+国番号` 形式 例 `+81 90 7170 0135`)。demoAccountRequired:false。
   - `PATCH /v1/apps/{id}` contentRightsDeclaration:"DOES_NOT_USE_THIRD_PARTY_CONTENT"。
5. **App Privacy(必須)**: ⚠️`appDataUsages` 系エンドポイントは **このAPIキーで全404**(アプリrelationshipsにも無い)。正解=**`fastlane upload_app_privacy_details_to_app_store` をレーン内で `asc_key` の後に呼ぶ**(api_key引数は無いがlane contextのトークンをspaceshipが拾う)。json=`[{"data_protections":["DATA_NOT_COLLECTED"]}]`。
6. **iPad要件**: device family `"1,2"` だと提出時に `SCREENSHOT_REQUIRED.APP_IPAD_PRO_3GEN_129`。iPhoneアプリは **`TARGETED_DEVICE_FAMILY:"1"`** にして回避→build番号上げて再ビルド/再アップロード。
7. **提出**: `asc.py submit <id>`。409時は `meta.associatedErrors` に**不足項目が全列挙**される(screenshot/reviewDetail/appDataUsages 等)→それを全部潰してから再提出。
8. **アプリ名衝突**: ja主言語名は作成時に空きなら通るが、en-USローカライズ追加で同名が他アプリと衝突しうる→ v1は ja単独掲載で出し、en-USは承認後に別名で追加。

## 追補2 (2026-06-22 Hibiで確定・produce 500と提出必須項目)

- **`fastlane produce` が「Server error got 500」で死ぬ最大要因 = bundleIdが事前に存在しない**。`skip_devcenter:true` を付けると produce は App ID(devcenter)作成をスキップし bundleId 既存前提で app record だけ作る→bundleId が無いと**名前と無関係に 500**(名前を変えても直らず名前衝突と誤診しやすい)。→ **必ず先に `setup_signing.py`(POST /v1/bundleIds で bundleId 作成)を実行してから produce**。順序: setup_signing → produce → archive → upload。
- **submit が 409 になる隠れ必須2点**(`meta.associatedErrors` はtruncateされるので直接dumpして全文読む):
  1. **primaryCategory 未設定** = `appInfos` の **relationship**(Deliverfileの`primary_category`だけでは付かない)。`PATCH /v1/appInfos/{appInfoId}` で `relationships.primaryCategory.data={type:"appCategories",id:"LIFESTYLE"}`(+secondaryCategory)。appInfoId=`GET /v1/apps/{id}/appInfos`。
  2. **APP_PRICING_REQUIRED** = 新規アプリにASCが自動生成する空のappPriceScheduleは**無効**。`POST /v1/appPriceSchedules` で USA free point を明示作成し直す(included appPrice に `"attributes":{}` 必須・既存あっても再POSTで201上書き)。
- **年齢宣言の必須属性(欠けると REQUIRED 409 が連鎖)**: ENUM"NONE"= violence*/sexual*/profanity*/mature*/horror*/medical*/alcohol*/gamblingSimulated/contests/**gunsOrOtherWeapons**。BOOL(false)= gambling/unrestrictedWebAccess/advertising/messagingAndChat/lootBox/healthOrWellnessTopics/parentalControls/userGeneratedContent/ageAssurance。kidsAgeBand=null。**`seventeenPlus` は存在しない**(入れると UNKNOWN 409)。
- **deliver スクショ二重UP**: deliver は1回目「missing on App Store Connect」→自動リトライで**各fileNameが2枚に重複**(6枚=3種×2)。submit前に重複削除必須=`DELETE /v1/appScreenshots/{id}`(各fileNameの2枚目以降)。**WAITING_FOR_REVIEW中は409で削除不可**→`asc.py reject <id>`(version→DEVELOPER_REJECTED)→各setをfileNameでグルーピングし1枚残して削除→`asc.py submit`で再提出。

## 追補4 (2026-07-16 艦隊6本一括v1.1提出で確定)

- **ITMS-90111パッチの再利用スクリプト**: `~/dev/suna-ios/tools/export_patched.sh <archive> <team> <out_dir> <bundle=profile>...`。アーカイブのBuildMachineOSBuildを25F80に書換→manual署名で-exportArchive→パッチ値とcodesign --deep --strictを自動検証。widget/appex同梱アプリは`bundle=profile`ペアを複数渡す（のこりwidget・ねむログLiveActivityで実証）。macOS 27 beta環境(26A5368g)の間は**全アプリのアップロードで必須**。
- **fastlane build レーンは `ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH/ASC_TEAM_ID` のenv必須**（keys.jsonから読んでexportしてから叩く）。ASC_TEAM_ID漏れは「requires a development team」でarchive死。
- **公開中アプリの更新フロー確定版**: 版数bump(project.yml)→fastlane ios build(またはxcodebuild archive)→export_patched.sh→altool→`make-version <id> <ver>`→新スクショをdeliver(`--app_version`指定・skip_metadata)→**sleep 20→dedup --apply**（deliver直後はdupが出そろわずdedupが空振りする。20秒待ってから）→`attach-build <id> <ver>`→`whatsnew`→`submit`→statusでWAITING_FOR_REVIEW裏取り→スクショはchecksumをローカルmd5と突合。
- **attach-buildの「no VALID build」で慌てない**: buildsはmarketing version(train)単位。同じbuild番号が旧trainに存在すると`status`のgrepで誤マッチする。`/v1/builds?include=preReleaseVersion`でtrainを見て、新trainのVALIDを待つ（アップロード後5〜15分）。
- **simctlスクショの2大罠**: ①起動直後キャプチャは空白（sleep 6〜7必須・75KB級の異常に小さいPNGは事故のサイン） ②直前に別アプリを撮っていると**ステータスバーに「◀ 前のアプリ」パンくず**が写る→terminate→launch→terminate→launchの二度起動でクリア。

## 追補3 (2026-07-03 Akariで確定・初回サブスク同梱提出)

- **サブスクが MISSING_METADATA から動かない最大の隠れ真因 = 審査用スクショのサイレント無効**。APIのassetDeliveryState=COMPLETE・UIプレビュー正常表示でも無効なことがある（fileNameが拡張子なし「SOURCE」等は危険信号）。直し=`DELETE /v1/subscriptionAppStoreReviewScreenshots/{id}` → 正規fileName(`xxx.png`)でPOST→PUT upload→PATCH uploaded:true+md5。**再UP後数秒で READY_TO_SUBMIT に即遷移**した。
- **価格はAPIでは自動均等化されない**。`POST /v1/subscriptionPrices`(基準地域1件)だけだと価格1地域のみ＝MISSING_METADATA要因。直し=`GET /v1/subscriptionPricePoints/{base}/equalizations?limit=200` で174地域分のpoint取得（territoryはpoint idのbase64内 `"t"` をデコード）→全地域分POST。**一時的500 UNEXPECTED_ERRORが数十件出る**→既存territoryをGETで突合し欠落分だけ指数バックオフでリトライ。
- **初回サブスクは reviewSubmissionItems に追加できない**（`'subscription' is not a relationship` 409）。同梱は**バージョンページの「アプリ内購入とサブスクリプション」セクション（UI）**で選択→審査提出。⚠️このセクションは**サブスクが READY_TO_SUBMIT になるまで非表示**（(オプション)表示でも初回は実質必須）。2本目以降はサブスク単独提出可。
- 有料App契約の確認はAPI非対応→ASC Web `/business`（有料アプリ契約=有効・銀行口座=有効を目視）。契約が有効でも上記2つ（スクショ/価格）が欠けてる限りMISSING_METADATAのまま。
- グループローカリゼーションPATCHやダミーサブスク作成による「状態再計算トリック」は**効かなかった**（フォーラム情報は不発）。

## 追補5 (2026-09-10 ひとくち勇者/SheetPin/11本ストア外しで確定)

- **却下(UNRESOLVED_ISSUES)後の再提出はAPIで完結する**: 同じ reviewSubmission の REJECTED item を `PATCH /v1/reviewSubmissionItems/{itemId}` `attributes.resolved:true` → item が READY_FOR_REVIEW に戻る → `PATCH /v1/reviewSubmissions/{id}` `submitted:true` で WAITING_FOR_REVIEW。⚠️先に `submitted:true` だけ叩くと「Version is not ready to be submitted yet, please try again later」(409)＝ミスリード。REJECTED item の DELETE は「already submitted」409、別submissionへの追加は ITEM_PART_OF_ANOTHER_SUBMISSION 409。`asc.py submit` が空のsubmissionを作って放置することがある（cancelもできない）→ 実害なし。
- **初回IAP/サブスク同梱の正解手順(UI+API混在)**: (1) ASC Web でサブスク/IAP の「審査用に追加」→ 既存の下書き(提出物)を選ぶ（**サブスクはグループだけでなく各サブスク本体も追加必須**。グループのみだと「そのグループに属する自動更新サブスクリプションとともに提出する必要」で提出ボタンが死ぬ） (2) その下書き id に API で `POST /v1/reviewSubmissionItems`(appStoreVersion) を足す（201で通る） (3) 右下「提出物の下書き」→「審査へ提出」。ASC の `/distribution/iaps` `/subscriptions/{id}` は**直URLだと白紙**→ version ページからサイドバー経由で遷移する。
- **ストアから消す(Remove from sale)は `PATCH /v1/territoryAvailabilities/{id}` `available:false` を全地域に**（175件/アプリ・約7分/アプリ）。`POST /v2/appAvailabilities` は既存アプリで **409 "already exists"**（作成専用）。地域一覧= `GET /v2/appAvailabilities/{appId}/territoryAvailabilities?limit=200`。戻しは同PATCHで true。検証は available の件数を数える。道具= `~/dev/lily-ios-tools/remove_from_sale.py`（dry-run既定・`--apply`）。
