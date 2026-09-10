---
name: plugin-cache-leak-axes
description: ~/.claude/plugins/cache の重量級調査・回収を行うとき発火。既知のリーク軸チェックリストと、orphan判定で live plugin を誤削除しない安全則。
author: auto
created: 2026-06-04
version: 1.0.0
---

## Procedure

`~/.claude/plugins/cache/<market>/<plugin>/<version>/` 構造を調査する。回収軸は順に確認:

1. **temp clone 残骸** — `find -type d \( -name 'temp_subdir_*' -o -name 'temp_git_*' \)`。
   接尾辞 `.clone` は任意（新 sync は省略）。glob は `temp_subdir_*` で無印も包含（Phase35）。
   pruner: `prune-plugin-clone-temp.sh`
2. **disabled dir** — `prune-disabled-plugin-cache.sh`
3. **旧 semver 版の併存** — 同一 plugin に複数 `X.Y.Z` dir。最高版 keep（Phase36）。
4. **semver/hash 混在 dir の旧版** — `installed_plugins.json[plugins][name@market][].installPath`
   の basename が loader 解決先＝keep。一致 sibling のみ削除（Phase37）。
   pruner: `prune-stale-plugin-versions.sh`（Pass1=semver / Pass2=installPath 権威）
5. **完全 orphan plugin dir** — disk にあるが installed_plugins.json に entry 無し。

6. **installed だが全プロジェクト未 enable の巨大 plugin**（Phase39）— installed_plugins.json に
   正規 entry があり cache GC 対象外だが、`~/.claude.json` の全 projects で enabledPlugins=0 の
   死蔵 plugin。例: sap-mdk-server 951M（SAP MDK・ユーザ無関係＝事故install 疑い）。
   **これは leak ではなく uninstall 案件。手動 dir 削除は禁止**（pruner が守る orphan を自作する矛盾）。
   正規 uninstall 経路でのみ除去 → autopilot では**報告のみ**に留める。

回収判定の権威は常に **installed_plugins.json の installPath**（realpath 比較）。
`~/.claude.json` の `enabledPlugins` はグローバルでは空のことがある（per-project 管理）ため
enablement の有無で **削除** 判断はしない（ただし軸6の uninstall **提案** 材料にはなる）。

## Pitfalls

- **dot/hyphen 正規化トラップ（重大）**: plugin KEY 名と on-disk DIR 名は別正規化。
  実例: key=`wordpress.com@...`（ドット）↔ dir=`wordpress-com`（ハイフン）。
  「dir 名 ∈ installed の key 名集合」で orphan 判定すると **live plugin を誤検出 → 誤削除**。
  必ず `installPath` を `realpath` 化した keep 集合と version dir の realpath を突合せよ。
  正しい突合では orphan=0 になる（誤判定は dir↔key 名の文字列照合が原因）。
- 大物（node_modules 同梱）は単版でも数百MB級（sap-mdk-server 951M/中 node_modules 895M,
  chrome-devtools-mcp 423M）。installed なら正規＝回収対象外。重い≠リークではない。
- **死蔵 elephant は suite 単位で疑え（Phase40）**: sap-mdk-server 単体ではなく
  sap-fiori-mcp-server / sap-cds-mcp も併存＝**SAP plugin 群の一括誤 install**。単発 fat-finger
  ではなく suite 丸ごと入る事故があるので、無関係ドメインの大物を見たら `grep -i <domain>` で
  兄弟 plugin も洗い、uninstall は suite まとめて提案する。
- **live 判定はセッションの connected MCP で確認できる**: `mcp__plugin_<name>_*` ツールが接続済み
  ＝実用中（chrome-devtools-mcp=接続→423M 正当）。未接続の installed 大物は死蔵候補
  （sap-mdk-server=未接続）。enablement 不在より接続実績の方が live の確証として強い。
- 「dry-run が no-stale」を鵜呑みにしない。実体（孤児 dir の mtime）と script 応答の矛盾を起点に
  glob/判定ロジックを疑う（Phase35）。

## Verification

- 全 pruner は既定 DRY-RUN、`--apply` で実削除（不文律）。
- 削除前: 対象が installed_plugins.json で #entries==1 か確認（stale entry 誤選択回避）。
- 削除後: `du -sh` で回収量、残存 active plugin の commands/agents/skills が intact・非空を実測、
  再 dry-run が「no stale」を返すこと、`~/.claude/scripts/dotfiles-snapshot.sh` で snapshot。

## 軸の恒常性に関する注意（Phase40）
- **軸2（多semver併存）は「一度ゼロ＝恒常ゼロ」ではない。** plugin が auto-update されるたび
  旧 semver dir が残り再生成する。「全軸クリーン」は時点観測に過ぎず、stale-version sweep は
  weekly cron で**周期実行**が前提（検出→恒久ゼロではなく churn 駆動で再発する軸）。
- 毎 Phase の再点検では「前回クリーンだったから今回もゼロ」と仮定せず、必ず disk スキャン
  （各 plugin dir の子 dir 数 >1 を列挙）＋ pruner dry-run を再実行すること。

## 軸7: registry-orphan（disk 削除済みだが installed_plugins.json に残骸）（Phase42）
- **disk-orphan の逆向き孤児。** plugin の on-disk dir が消えた（uninstall/手動削除/cache 飛び）のに
  installed_plugins.json には entry が残る状態。registry が存在しない installPath を指す＝plugin load 時の
  エラー源になりうる。Phase42 実例: ユーザが SAP suite(951M+) を uninstall→cache 1.7G→550M に縮んだが、
  installed_plugins.json には sap-mdk-server / sap-fiori-mcp-server / sap-cds-mcp の3 entry が残骸として残存。
- **検出**: `find plugins/cache -maxdepth 2 -iname '*<name>*' -type d`（on-disk 権威）が空 かつ
  `grep -o '<name>-[a-z-]*' installed_plugins.json` がヒット → registry-orphan 確定。
  grep の生カウントは信用せず on-disk find と突合する（Phase38 則の再適用）。
- **安全則**: registry を手編集しない。それ自体が「壊れた参照を自作する」矛盾で、
  正規 uninstall 経路（`claude plugin uninstall <name>`）でのみ除去すべき。autopilot は報告のみ。
- **第2の側面（Phase44）**: registry-orphan は cache/ だけでなく `plugins/data/<name>-claude-plugins-official/`
  にも 0B 空 stub dir として残る（SAP 3本で実観測）。`find plugins/cache -iname '*sap*'` を cache 限定で
  打つと「disk 完全消滅」と誤認するが、`plugins/data/` まで広げると stub が出る。回収余地は 0B ゆえ無いが、
  registry⇔cache⇔data の三方向で残骸が散る点に注意。正規 uninstall は3者を一括除去する。

## 軸1 の再蓄積と「02-03時の死角」（Phase42）
- 日次 3am GC ＋ clone-temp の <60min 安全窓が組み合わさると、02:00-03:00 に生成された clone は
  3am 時点で「<60min」と判定され除外され、次の 3am まで丸1日生き残る（構造的死角）。実害は軽微(~1M)。
- Phase41 で clone-temp/stale-versions pruner を日次 purge に配線済だが、上記死角ゆえ手動 Phase でも
  dry-run→--apply の sweep は依然有効（Phase42 で 9 dir/1.2M 回収）。
- **軸1 は二相ある（Phase46 で確定）**: (A) 進行中 live clone（age<60min・自己 cleanup・温存）と
  (B) marketplace refresh 中断で stuck した死蔵 orphan（age≫60min・要回収）。Phase43-45 は (A) しか
  見ず「clone-temp は触るな」と結論したが不完全。Phase46 で temp_git 76→114 dir が age≈4.5h で死蔵化、
  **50M/114 dir 回収**。age を epoch_ms から逆算し >60min なら堂々と --apply してよい（live は
  <60min 安全窓が自動で守る）。毎 Phase --apply まで回すのが正解。

## 軸8: disabled-plugin cache（無効化済プラグインの node_modules 残留）（Phase45）
- **最大の見落とし軸。** plugin を無効化（settings.json:enabledPlugins から外す/false）しても、cache の
  marketplace mirror（重い node_modules 含む）は disk に残り続ける。`prune-disabled-plugin-cache.sh` が
  「cache dir 名 ∉ enabledPlugins(true)」を disabled と判定し回収する。Phase45 で 61M/11 dir 回収。
- **Phase43-44 の誤判定を訂正**: zscaler 42M を「installed live ゆえ温存」と書いたが**誤り**。zscaler は
  enabledPlugins に不在＝disabled で回収対象だった。「サイズが大きい＝live」ではなく、必ず
  `enabledPlugins[<name>]==true` を突合して live/disabled を切り分けること。chrome-devtools-mcp は
  =true ゆえ 423M 温存が正しい（本物の live）。
- **検出**: `prune-disabled-plugin-cache.sh`（dry-run 既定）。--apply で削除。再 dry-run「nothing to reclaim」で確認。
- **潜在バグ（要注意）**: 判定は dir名と enabledPlugins キーの厳密一致。cache dir は `wordpress-com`、
  settings キーは `wordpress.com` のように**区切り文字が食い違う**ケースがあり、enabled な plugin を
  disabled と誤判定して削除する偽陽性リスクがある。Phase45 時点では該当 dir が全て真に disabled
  ゆえ無害だったが、--apply 前に「リストされた dir が enabledPlugins(true) に不在」を確認すべき。
- **net du の罠（Phase43 再掲）**: --apply 後の `du` が下がらない/増えることがある。live clone transient が
  調査中に湧くため。回収成否は du でなく「再 dry-run が nothing to reclaim」で判定すること。

## 軸2 スクリプト名の訂正（Phase45）
- Phase44 で「`prune-plugin-stale-versions.sh` が現存せず」と記録したが**glob の見間違い**。
  正しい実ファイル名は `prune-stale-plugin-versions.sh`（stale が先）。存在し dry-run 走査可能。

## 手動掃除の補足（旧 plugins-cache-gc / prune-plugin-clone-temp から吸収）
- **prune-plugin-clone-temp.sh の引数**: `[MIN_AGE_MIN]`（既定60分）。それより新しい temp は
  in-flight install 保護で温存される。実行後 `~/.claude/scripts/dotfiles-snapshot.sh` で snapshot。
- **bash 3.2 制約**: macOS 既定 bash では `mapfile`/`readarray` 不可。残骸処理は `find -exec` で書くこと。
- **削除後に MCP サーバ起動エラー**が出たら Claude Code 再起動 → cache は自動再 fetch される
  （最新版のみ残せばリカバリ可能）。
- 重複名 plugin（sap-cds-mcp / cds-mcp 等）は `diff -rq` で同一内容か確認してから判断。

## 実績ログ
- 2026-05-31 Phase19: 3.0GB→2.0GB（temp_git_* 20個92MB + chrome-devtools-mcp 旧3世代~900MB）
- 2026-05-31 clone-temp 初回: temp_subdir 44残骸 262M 回収、2.0G→1.8G
- 2026-06 Phase42: 9 dir/1.2M、Phase45: disabled 61M/11 dir、Phase46: temp_git 50M/114 dir
