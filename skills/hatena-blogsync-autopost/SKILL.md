---
name: hatena-blogsync-autopost
description: はてなブログへCLIで自動投稿/公開したい時。Markdownドラフトを生成→はてなに下書きor即公開まで自動化する（blogsync）。楽天アフィリリンクの埋め込み不具合の対処も含む。
author: auto
created: 2026-06-19
version: 1.1.0
---

## Procedure

### はてなブログ自動投稿（blogsync）
1. インストール（Goが要る。macOSはソースビルドなのでGLIBC問題なし）:
   `GOBIN=$HOME/.local/bin go install github.com/x-motemen/blogsync@latest`
2. 設定 `~/.config/blogsync/config.yaml`（chmod 600。password=AtomPub APIキー＝秘密）:
   ```yaml
   default:
     username: <はてなID>
     password: <AtomPub APIキー>
   <blog>.hatenablog.com:
     username: <はてなID>
     password: <AtomPub APIキー>
   ```
   - APIキー取得: はてなブログ管理画面 → 設定 → 詳細設定 → 「AtomPub」欄のAPIキー。はてなIDはエンドポイントURL内の名前。
   - **秘密はチャットに出させない**。`! open -e ~/.config/blogsync/config.yaml` で本人に直接貼ってもらう（Stop hookで会話が知識ベースに取り込まれるため）。
3. 疎通は読み取りで（書き込みなし）: `blogsync -C /tmp/bs pull <blog>.hatenablog.com`
4. 投稿: stdinに本文、タイトルは別指定。
   - 下書き: `blogsync post --draft --title 'T' <blog> < body.md`
   - 公開: `blogsync post --title 'T' <blog> < body.md`（--draftを外すと公開）
   - 戻り 201 = 作成成功。下書きはレスポンスにPreviewURLが入る。
   - 削除: `blogsync remove <localmirror.md>`（テスト下書きの後始末に）
5. 本文1行目の `# タイトル` はエントリTitleに使い、本文からは除く（H1重複回避）。

### 消化キュー型パイプラインとの統合（affiliate-factory型）
- Desktop等に「未投稿md数」を数えて3本に補充する方式なら、**公開したmdはキューdirから外す**こと（`published/`へmv）。残すと翌日「足りてる」と誤認して生成が止まる。
- daily.shの末尾で `post-to-hatena.sh --publish --all` を呼ぶ。config未設定なら誤爆せずスキップするガードを必ず入れる（`grep -q REPLACE_ config && exit 0`）。

## Pitfalls
- **楽天アフィリリンクが本文に入らない**最大の罠: LLMが本文に自前の検索URL `[楽天で「X」を探す](https://search.rakuten.co.jp/...)` を書く。プレースホルダー置換だけだと**実URLが残り報酬ゼロ**。`re.sub(r"\[楽天で「[^」]*」を探す\]\([^)]*\)", affiliate_link, body)` で実リンクを丸ごと差し替える。
- **0件→非アフィリにフォールバックする罠**: 楽天商品検索APIが0件/エラーでも、素の検索URLでなく**アフィリ計測付き検索リンク(hgc)**へ落とす:
  `https://hb.afl.rakuten.co.jp/hgc/<AFFILIATE_ID>/?pc=<enc検索URL>&m=<enc検索URL>`
  （`AFFILIATE_ID`は`5501af..xxxx.5501af..yyyy`形式の35文字＝そのままhgcパスに入る。リダイレクト先に`scid=af_pc_etc`が付けば計測OK）。
- **NGKeywordを盛りすぎると0件**になる。`中古 訳あり 美品` 程度に留め、アクセサリ除外は `minPrice`（本体5万円級なら30000）で行う。
- **一部ブランド語はAPIが弾く**（例: `EcoFlow`→`keyword is not valid`/HTTP400）。`ポータブル電源`等の一般語はOK。弾かれたらhgc検索リンクへフォールバックで報酬は維持できる。
- API叩きすぎで **429 Too Many Requests**。検証は間隔を空け1回ずつ。
- **`[:contents]`(目次記法)が引用ボックス内に吸い込まれ目次化されない罠**: 免責は `> ` のblockquote。直後に空行なしで `[:contents]` を置くと、Markdownの**遅延継続(lazy continuation)**で `[:contents]` が引用に取り込まれ、目次が出ずリテラル表示される。`[title, "", disclaimer, "", contents]` のように**前後を空行で分離**する。既存記事の一括修正は「`[:contents]`の直前が空行でなければ空行挿入」する冪等スクリプトで。
- **`blogsync push` を同一ファイルに多重呼び出しするとローカルmdが消える罠**: pushは成功時にレスポンスの正規パスへローカルファイルを**再配置**する。ループ内で1ファイルを2回以上pushすると2回目で「no such file」になり、出力ステータス判定も壊れる(401/402誤検出)。**1ファイル=1回だけpush**し、生ログの `PUT --->` 直後の `200 <---` で成否判定する。ローカルが壊れても本番は無事＝`blogsync pull` で復元できる(entryは本番ミラー)。
- 楽天Ichiba新API: `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401`（applicationId＋accessKey＋affiliateId。Referer/Originヘッダを付ける）。
- **launchd実行で同じ記事が毎回重複公開される最悪の罠（2026-06-23実害・3重投稿）**: blogsyncは`post`成功(201)の**後に**エントリmdを「カレントディレクトリ配下」へ`store`する。launchdは`cwd=/`（read-only）で起動するため`store`の`mkdir <blog>.hatenablog.com`が`read-only file system`で失敗→**POSTは成功しているのにblogsyncが非0終了**。`post_one`が失敗扱いし、ドラフトをキューに残す→次の定時実行が再投稿→ライブ上に同一記事が量産される。対症療法では気付けない（手動shellはcwdが書込可能なので再現しない）。**根治＝blogsync呼び出し前に書込可能な作業dirを固定**: `export BLOGSYNC_WORKDIR="${BLOGSYNC_WORKDIR:-$HOME/.cache/blogsync}"; mkdir -p "$BLOGSYNC_WORKDIR"`（`-C <dir>`でも可。env名は`blogsync --help`の`[$BLOGSYNC_WORKDIR]`）。重複検出＝`blogsync pull`して`grep -rl '<タイトル>' | wc -l`、掃除＝`blogsync remove <localmirror.md>`（pull後にローカルmdが要る）。
- **「0分で完了」「未公開キュー残>0なのに公開0」はstore失敗のサイン**。run-and-notify等のラッパで`START→END`が同時刻なら、生成は使用量制限で空振り＋公開がstoreで死んでいる複合。daily.logが更新されないのはラッパがstdoutをtempに吸うため（plistのStandardOutPathは無関係になる）。

## Verification
- `blogsync pull` が既存記事を取得できる＝認証OK。
- 公開後: `curl -s https://<blog>.hatenablog.com/ | grep '<記事タイトル>'` でトップに出現確認。
- 公開ページを `curl` して `hb.afl.rakuten.co.jp/hgc/` リンクが残っている＝アフィリ計測が生きている。
- Markdownの `Draft:` フィールドが無ければ公開済み。
