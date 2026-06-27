---
name: vercel-dns-catchall-email
description: Vercel DNS管理のドメインに無料のcatch-allメール受信転送を付けたい時。第三者アカウント作成なし・DNSレコード追記だけでForward Emailにより全アドレスをGmail等へ転送する。送信は対象外（受信のみ）
author: auto
created: 2026-06-27
version: 1.0.0
---

## Procedure

Vercel DNS（NSが`*.vercel-dns.com`）のドメインに、`*@domain` を1つの転送先へ集約する受信専用メールを構築する。

> 🚨**最初に判定**: 対象ドメインの**作成/失効が90日以内なら Forward Email無料は使えない**（新規ドメインをブロック、$3/月で解除）。`whois <domain> | grep -i creat` や Vercel `vercel domains ls --scope <id>` のAge列で確認。**新規ドメイン → ImprovMX無料を使う**（下記「ImprovMX経路」）。90日超の枯れたドメイン → Forward Email DNS-only（アカウント不要で全自動）。

### Forward Email経路（90日超ドメインのみ・アカウント不要）

1. **前提確認**（既存メール設定との衝突回避）:
   ```bash
   dig +short MX <domain> @8.8.8.8     # 既にMXがあれば衝突→別対応
   dig +short TXT <domain> @8.8.8.8    # 既存SPFがあればマージ必要
   ```
   既存MX/SPFが無ければ追記はライブサイトに無影響。

2. **Vercelスコープを特定**（罠）: プロジェクトの `~/dev/<proj>/.vercel/project.json` の `orgId`（`team_xxxx`）を読む。`vercel dns ls/add` は**デフォルトスコープだと "You don't have permission"** で弾かれることがある（`vercel teams ls` に出ないチームでも）。**必ず `--scope <orgId>` を付ける**。
   ```bash
   cat ~/dev/<proj>/.vercel/project.json   # orgId取得
   vercel dns ls <domain> --scope <orgId>  # 権限OKか確認
   ```

3. **最新のDNS値を裏取り**（ハードコード禁止）: `https://forwardemail.net/en/faq` をWebFetchで確認。2026-06時点の値:
   - MX `@` → `mx1.forwardemail.net`（priority 0）
   - MX `@` → `mx2.forwardemail.net`（priority 0）
   - TXT `@` → `forward-email=<dest>@gmail.com`（プレフィックス無し=catch-all。全アドレスをdestへ）
   - TXT `@` → `v=spf1 a include:spf.forwardemail.net -all`

4. **追加**（zshは`$VAR`を単語分割しない→フラグは直書き）:
   ```bash
   cd ~/dev/<proj>
   vercel dns add <domain> '@' MX mx1.forwardemail.net 0 --scope <orgId>
   vercel dns add <domain> '@' MX mx2.forwardemail.net 0 --scope <orgId>
   vercel dns add <domain> '@' TXT 'forward-email=<dest>@gmail.com' --scope <orgId>
   vercel dns add <domain> '@' TXT 'v=spf1 a include:spf.forwardemail.net -all' --scope <orgId>
   ```

5. 特定アドレスだけ別の転送先に分けたい場合は catch-all の代わりに:
   `forward-email=contact:a@gmail.com,aibijo:b@gmail.com` のようにプレフィックス指定。集約+Gmailラベル仕分けで足りるなら catch-all 1本でよい。

### ImprovMX経路（新規ドメイン可・無料・要アカウント1回）

新規ドメインで Forward Email が使えない時の本命。ImprovMXは新規ドメイン制限なし・無料で 1ドメイン/25エイリアス/catch-all。

1. DNSを先に差し替え（私がCLIで実施。Forward Emailのレコードが残っていれば**MX/SPF/forward-email TXTを全削除**してから）:
   ```bash
   cd ~/dev/<proj>
   vercel dns add <domain> '@' MX mx1.improvmx.com 10 --scope <orgId>
   vercel dns add <domain> '@' MX mx2.improvmx.com 20 --scope <orgId>
   vercel dns add <domain> '@' TXT 'v=spf1 include:spf.improvmx.com ~all' --scope <orgId>
   ```
   削除は `vercel dns ls <domain> --scope <orgId>` でrec_id確認→`vercel dns rm <id> --yes --scope <orgId>`。
2. **本人がやる手動（~2分）**: improvmx.com で転送先Gmail（Google）サインイン→ドメイン追加（MX/SPFは設定済で即検証OK）→エイリアス作成: catch-all `*`→転送先（無料で不可なら個別 contact@/aibijo@ 等）。
3. ImprovMXはAPIあり（`api.improvmx.com`）。本人のAPIキー入手後はエイリアスをcurlで作成可＝完全自動化できる。

## Pitfalls

- **scope必須**: `--scope <team_id>` 無しは権限エラー。`vercel teams ls` に出なくてもscope明示でアクセス可。
- **zsh単語分割なし**: `S="--scope x"; cmd $S` は1トークン扱いで `unknown option` になる。フラグはコマンドに直書きするか `${=S}`。
- **送信は別物**: これは受信転送のみ。`<addr>@domain` から送りたいなら Gmail「Send mail as」+ SPFに `include:_spf.google.com` 追記が別途必要。
- 既存MX/SPFがあるドメインは上書き注意（SPFは1レコードにマージ）。
- 転送先Gmailは最初フォワードメールをスパム判定することがある→受信したら「迷惑メールでない」を押す。

## Verification

実メールを送らずに catch-all 稼働を確認（port25が通る環境）:
```bash
python3 - <<'PY'
import smtplib, socket
socket.setdefaulttimeout(15)
for h in ("mx1.forwardemail.net","mx2.forwardemail.net"):
    s=smtplib.SMTP(h,25); s.ehlo("probe.local")
    s.mail("probe@example.com")
    print(h, s.rcpt("anything@<domain>"))   # (250, b'... Accepted') ならOK
    s.quit()
PY
```
`250 ... Accepted` はMXが**受理した**だけ。⚠️**RCPT 250 は実転送を保証しない**（新規ドメインのForward Emailは250で受けてから転送せずupgrade要求を返す）。**最終確認は必ず実メールを1通送って転送先に着信するか**で行う。「完璧？」と聞かれても実着信テスト前は「受信インフラOK・実配信1通だけ未確認」と正直に切り分けて報告する。
