---
name: claude-plugin-context-audit
description: セッション開始が重い/応答が直近指示を取りこぼす/context bloatが疑われるとき、SessionStartで注入される全ソース（プラグイン・rules/ecc・obsidian文脈・auto-memory・remember）のトークン内訳を測定して刈り込み候補を特定したいとき
author: auto
created: 2026-05-29
version: 1.1.0
status: active
---

## Procedure

1. 有効プラグイン数と総プラグイン数を確認する
   ```bash
   cat ~/.claude/settings.json | python3 -c "
   import json,sys; d=json.load(sys.stdin)
   plugins = d.get('plugins', {})
   enabled = [k for k,v in plugins.items() if v.get('enabled', False)]
   print(f'enabled: {len(enabled)} / total: {len(plugins)}')
   for p in sorted(enabled): print(' -', p)
   "
   ```

2. 直近30日のセッションJSONLから実際に使ったプラグイン/スキルを集計する
   ```bash
   cd ~/.claude/projects
   find . -name "*.jsonl" -type f -mtime -30 | xargs grep -h '"toolName"\|"skill"\|/[a-z]' 2>/dev/null \
     | grep -oE '"toolName":"[^"]+"' | sort | uniq -c | sort -rn | head -30
   ```

3. セッション開始時にcontextに注入されるskillメタデータ量を測定する
   ```bash
   # 最新セッションファイルを特定
   SF=$(find ~/.claude/projects -name "*.jsonl" -type f -newer ~/.claude/settings.json | sort -t/ -k8 | tail -1)
   # skill一覧ブロックのサイズを確認
   wc -c <<< "$(grep -o '"text":"[^"]*skills are available[^"]*"' "$SF" 2>/dev/null)"
   ```

4. 実績ゼロのプラグインを洗い出して監査レポートを作成する
   ```bash
   cat > ~/.claude/improvements/plugin-audit-$(date +%Y-%m-%d).md << 'EOF'
   # Plugin Audit
   ## 有効だが未使用（直近30日）
   [手順2の結果と照合して記入]
   
   ## 無効化候補
   [具体的なプラグイン名をリスト]
   EOF
   ```

5. 無効化を実行する（破壊的変更のため確認してから）
   ```bash
   # 特定プラグインを disable（settings.json を直接編集）
   python3 -c "
   import json
   with open('$HOME/.claude/settings.json') as f: d = json.load(f)
   targets = ['plugin-name-1', 'plugin-name-2']  # 削減対象
   for t in targets:
       if t in d.get('plugins', {}):
           d['plugins'][t]['enabled'] = False
   with open('$HOME/.claude/settings.json', 'w') as f: json.dump(d, f, indent=2)
   print('done')
   "
   ```

6. プラグイン以外の注入源の内訳を測定する（症状が「直近指示の取りこぼし/話の混線」のとき本命はこっち）
   ```bash
   echo "== rules/ecc 全文注入（~/.claude/rules/ 配下はグローバル指示として自動フルロード・上限なし）=="
   find ~/.claude/rules/ecc -name '*.md' -exec cat {} + | wc -c   # bytes/4≒英tok
   echo "== obsidian文脈（obsidian_context.shが注入。MAX_CHARSで上限済み＝肥大しても注入は一定）=="
   grep -E 'MAX_CHARS|head -c|sed -n' ~/.local/bin/obsidian_context.sh
   echo "== auto-memory（MEMORY.md全文注入）=="; wc -c ~/.claude/projects/*/memory/MEMORY.md
   echo "== remember（now/recent/archive/today を注入。*.done.mdは注入対象外）=="
   wc -c ~/.remember/now.md ~/.remember/recent.md ~/.remember/archive.md
   ```

7. rules/ecc を刈り込む（最大効果・破壊的ではない＝rules外へ退避するだけ）
   ```bash
   # 使う言語だけ残す。残り＋zh/(中国語完全重複)をrulesツリーの外へ逃がす（隠しdirでも誤ロード回避のため外）
   A="$HOME/.claude/.rules-archive/ecc"; mkdir -p "$A"; cd ~/.claude/rules/ecc
   for d in angular arkts cpp csharp dart fsharp golang java kotlin perl php ruby rust swift zh; do
     [ -d "$d" ] && mv "$d" "$A/"; done
   # 復元は mv "$A/rust" ~/.claude/rules/ecc/ で1個ずつ
   ```

## Pitfalls

- **症状の切り分け**: 「セッションが重い」だけならプラグイン(手順1-5)。「応答が直近のユーザー指示を取りこぼす/前の話題と混線する」なら注入総量が犯人で、本命は rules/ecc 全文注入(手順6-7)。実測では rules/ecc が単独で ~45-57K tok を占め全注入の最大ブロックだった
- **rules/ecc は @import ではなく自動ディレクトリロード**。`~/.claude/rules/` 配下を Claude Code がグローバル指示として全文読む。だから import 行修正は不要、ファイルをツリー外へ mv するだけで注入が止まる。**ロールバックは mv で戻すだけ＝非破壊**
- **obsidian hot.md / index.md は触っても注入は減らない**。`obsidian_context.sh` が hot.md=9000字 / index=2500字で既に上限カット済み。ファイルが32KBに膨らんでても注入は ~7K tok 一定。ディスク掃除と注入削減を混同しない
- **remember の today-*.done.md も注入対象外**。掃除はディスク整理であってトークンは減らない

- MAXプランなら$/tokenコストへの影響はない。削減のメリットは「context窓の節約」「キャッシュヒット率の安定化」「セッション起動の高速化」
- `disable` は settings.json の `true→false` だけで即ロールバック可能。`claude plugin uninstall` は物理ディスクも回収するが非可逆
- プラグインを disable するとそのプラグインが提供するスラッシュコマンドがエラーになる。稀にしか使わないが重要なコマンドは disable しないこと
- セッション内で既に読み込まれたskillメタは次回起動まで残るため、効果確認は新規セッションで行う

## Verification

```bash
# 無効化後の有効プラグイン数確認
cat ~/.claude/settings.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
enabled = [k for k,v in d.get('plugins',{}).items() if v.get('enabled',False)]
print(f'enabled plugins: {len(enabled)}')
"
# 新規セッションを開いてcontext先頭のskill一覧が短くなっていれば成功
```
