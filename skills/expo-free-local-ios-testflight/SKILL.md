---
name: expo-free-local-ios-testflight
description: EASの無料iOSビルド枠を使い切った/有料を避けたい時に、ローカル手動署名でExpoアプリをビルドしTestFlightへ無料提出する。`eas build`が"used its iOS builds from the Free plan this month"で止まる時に発火。
author: auto
created: 2026-06-17
version: 1.3.0
---

## Procedure

EAS無料枠ゼロでもクラウド不要・無料でTestFlightに出せる。Mac(Xcode)＋Apple Developer＋既存EASプロジェクト前提。

### 最短（まず試す）：重複Distribution証明書を消すだけ ★2026-06-19 実証
`eas build --local` が `provisioning profile doesn't include signing certificate "Apple Distribution: …"` で落ちる時、**多くはcredentials.jsonもsighも不要**。原因は単純な名前衝突：ログインキーチェーンに「Apple Distribution: <Name>」が複数あり、ローカルアーカイブがEASプロファイル(EAS証明書入り)と別の証明書を掴むだけ。EASの`--local`は自前証明書を一時キーチェーンに入れて署名するので、**衝突する別証明書をローカルから消せばデフォルトのremote資格情報のまま通る**。
1. 照合：`security find-identity -v -p codesigning | grep "Apple Distribution"` で各証明書のSHA-1。`eas credentials -p ios`が出すEAS管理証明書の**Serial**と、ローカル証明書のSerial(`security find-certificate -c "Apple Distribution: <Name> (TEAM)" -p | openssl x509 -noout -serial`)を比較→**違えば別物＝衝突原因**。
2. EAS管理でない方(古い重複)を削除：`security delete-identity -Z <SHA-1>`（このMacでGUI不要・RC=0で通った。**可逆**＝Apple側には残り再DL可）。削除後ローカルにDistribution証明書が0枚でも問題なし（EASがビルド時に一時キーチェーンへ供給）。
3. 必要なら `eas credentials -p ios` → Build Credentials → `Provisioning Profile: Delete one from your project` → `All: Set up all` でEAS証明書入りの新プロファイルを再生成（古いprofileが残っている場合）。
4. 再ビルド：`eas build -p ios --profile production --local --non-interactive --output build.ipa`（log開始75-90秒で `doesn't include signing certificate` が0なら署名突破＝あとはコンパイル）。→ `Build successful` ＋ build.ipa 生成。
5. 提出：`eas submit -p ios --profile production --path build.ipa --non-interactive`（ascAppId設定済・2FA不要）。
⚠️**stray証明書は再混入する**(複数回観測)。`eas build --local`のcredential準備が失敗ビルド時などにlogin keychainへ別Distribution証明書(serial違い)を書き戻すため、成功した次のビルドでまた落ちることがある。対処＝**ローカルビルドを回す直前に毎回 `security find-identity -v -p codesigning | grep Distribution` で確認し、EAS profileのSerialと違う証明書があれば `security delete-identity -Z <SHA1>` してから build**。恒久対策は**Apple/EASのDistribution証明書を1枚に統一**(`eas credentials`→`Distribution Certificate: Delete one from your account`で古い方をrevoke→profile再生成)＝2枚あるとEASがビルド毎に別証明書を掴んで不整合になる。
これで直らない時のみ↓のcredentials.json/sighルートへ。

### 推奨（簡潔）：`eas build --local` ＋ ローカルcredentials.json
fastlane gym手組みより楽。EASがprebuild/pod/archive/exportを代行し、buildNumberもEAS remoteで自動採番。`eas build --local`が `provisioning profile doesn't include signing certificate "Apple Distribution: …"` で落ちる時の決定打。**原因＝EASのリモートprofileはEAS発行証明書を埋め込むが、ローカルXcodeアーカイブはKeychainの別Distribution証明書を掴むため**（`eas credentials`でprofile再生成しても、EAS証明書を埋めるので直らない）。

1. ローカルDistribution証明書を確認：`security find-identity -v -p codesigning | grep "Apple Distribution"` → 指紋(SHA-1)を記録。
2. それを含むApp Store配布プロファイルを用意：リポに `*.mobileprovision` があれば中身を照合 →
   `security cms -D -i x.mobileprovision > p.plist` し、`DeveloperCertificates:0` のSHA-1がローカル証明書と一致するか確認（plistlibでDER→sha1）。一致すればそれを使う。無ければ手順3(sigh)で生成。
3. ローカル証明書だけのクリーンな.p12を書き出す（`security export`は全ID混在＋openssl3が読めないので要整形）：
   - `security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -P <pass> -o /tmp/all.p12`（このMacではGUI許可不要で通った）
   - `openssl pkcs12 -in /tmp/all.p12 -passin pass:<pass> -legacy -nodes -out /tmp/all.pem`（**-legacy必須**）
   - Distribution証明書とmodulus一致の秘密鍵だけ抽出し再パッケージ：`openssl pkcs12 -export -legacy -in dist-only.pem -out /tmp/dist.p12 -passout pass:<pass>`
4. `credentials.json`（**gitignore必須**・秘密）をプロジェクト直下に：
   ```json
   {"ios":{"provisioningProfilePath":"x.mobileprovision","distributionCertificate":{"path":"/tmp/dist.p12","password":"<pass>"}}}
   ```
   .p12は`/tmp`の絶対パスでリポ外に置く。
5. `eas.json`の該当buildプロファイルに `"credentialsSource": "local"` を追加。
6. `npx eas build --local --platform ios --profile production --non-interactive --output ./build/app.ipa`
   → ログに `Using local iOS credentials (credentials.json)` → 突合通過 → `Build successful`。
7. 提出：`npx eas submit --platform ios --profile production --path build/app.ipa --non-interactive`（ascAppId設定済前提・2FA不要）。
8. 検証：.ipaのAppIcon抽出はiOS最適化PNGなので`sips -s format png`で標準化してから目視。`embedded.mobileprovision`の証明書SHA-1がローカル証明書と一致を確認。

### 代替（fastlane手組み）：

1. **App Idにcapability反映＋プロファイル整備**（push等を足した直後のみ）：本人が `! eas build -p ios --profile production` を対話実行→Appleログイン→capability sync→「Generate new provisioning profile?」Yes→（枠エラーで最後落ちるが無視。creds整備が目的）。
2. **ローカル証明書を確認**：`security find-identity -p codesigning -v | grep Distribution`。"Apple Distribution: <Name> (TEAMID)" があればその指紋を使う。**EAS発行の"iPhone Distribution"型はXcode26で弾かれる**ので、Mac Keychainの"Apple Distribution"を使うのが鍵。
3. **そのローカル証明書に合うApp Store配布プロファイルを生成**（本人が`!`で2FA入力）：
   `! fastlane sigh renew --app_identifier <bundleId> --team_id <TEAMID> --platform ios --output_path /tmp/prof --filename app.mobileprovision`
   → sighが「EAS証明書はローカルに鍵なし」を検知し、ローカル証明書入りの新プロファイルを生成。UUID/Name/aps-environmentは `security cms -D -i ...mobileprovision` で確認。
4. **キーチェーン署名許可**（codesignのGUIポップアップ＝ヘッダレスでハングするのを防止。本人がMacパス入力）：
   `! read -rs "PW?Macパス: "; security unlock-keychain -p "$PW" ~/Library/Keychains/login.keychain-db && security set-key-partition-list -S apple-tool:,apple: -s -k "$PW" ~/Library/Keychains/login.keychain-db; unset PW`
5. **buildNumberを既存TestFlight超えに**：app.json `ios.buildNumber` を手動で上げる（ローカルビルドはEAS remote versioningを使わないため必須）。
6. **prebuild＋手動署名gym**（バックグラウンド可・DerivedDataキャッシュで2回目以降速い）：
   `npx expo prebuild -p ios --clean` →
   `cd ios && fastlane gym --workspace *.xcworkspace --scheme <Scheme> --configuration Release --output_directory /tmp/ipa --output_name app.ipa --export_options /tmp/export.plist --xcargs "CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=<TEAMID> PROVISIONING_PROFILE_SPECIFIER=\"<ProfileName>\" CODE_SIGN_IDENTITY=\"Apple Distribution: <Name> (TEAMID)\""`
   export.plist = method:app-store / teamID / signingStyle:manual / provisioningProfiles:{<bundleId>:<ProfileName>} / uploadSymbols:true。
7. **提出**（2FA不要・ASC APIキー使用）：`eas submit -p ios --path /tmp/ipa/app.ipa --non-interactive`（eas.json submit.production.ios.ascAppId 設定済前提）。
8. 後片付け：`git checkout package.json`（prebuildがscriptsをrun:に書換える）、`rm -rf ios android`（managed運用なら）。

## Pitfalls

- **証明書2種の罠**：EASは"iPhone Distribution"型を発行、Xcode26ローカルは"Apple Distribution"を要求→`profile doesn't include signing certificate`連発。→ローカルの"Apple Distribution"＋sigh生成プロファイルで解決。
- **codesignがハング(exit 144)**：キーチェーン許可ポップアップをヘッダレスで押せず。→手順4を先に実行。
- **buildNumber衝突**：ローカルビルドはCFBundleVersion=1になりがち→既存TestFlight超えに手動採番。
- **git push失敗(Device not configured/no oauth token)**：keyringアクセス不可。本人が`! git push`で。
- fastlane/eas のApple 2FAは対話必須＝本人が`!`で6桁入力。提出(eas submit)はASC APIキーで2FA不要。

## Verification

- ipa確認：`unzip -q app.ipa -d x; /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' x/Payload/*.app/Info.plist`（既存超えか）。
- gymログに `Successfully exported and signed the ipa file`。
- eas submitログに `Submitted your app to Apple App Store Connect!` ＋ TestFlight URL。5-10分でApple処理→TestFlight反映。
