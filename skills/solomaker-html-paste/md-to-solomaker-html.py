#!/usr/bin/env python3
"""maker記事(markdown) → solomaker貼り付け用HTMLページ を生成する。

solomakerのエディタは TipTap(ProseMirror)。プレーンテキストのMarkdownは解釈しないが、
クリップボードに text/html が乗っていれば見出し/太字/区切り線/リストを正しく取り込む。
そこで「タイトルをコピー」「本文をコピー(見出し付き)」の2ボタンを持つHTMLを吐く。
ボタンは navigator.clipboard.write で text/html を書き込むので、貼り付けだけで整形が効く。

usage: md-to-solomaker-html.py <src.md> <out.html>
"""
import re
import sys
import html as htmlmod
from pathlib import Path

import markdown


def split_frontmatter(raw: str):
    title = ""
    m = re.match(r"^---\n(.*?)\n---\n", raw, re.S)
    if m:
        tm = re.search(r'^title:\s*"?(.*?)"?\s*$', m.group(1), re.M)
        if tm:
            title = tm.group(1)
        return title, raw[m.end():]
    return title, raw


def main():
    src, out = sys.argv[1], sys.argv[2]
    raw = Path(src).read_text(encoding="utf-8", errors="ignore")
    title, body_md = split_frontmatter(raw)
    body_md = body_md.strip()

    # 本文HTML(見出し/段落/hr/リスト/太字/リンク)
    body_html = markdown.markdown(body_md, extensions=["extra", "sane_lists"])

    title_txt = title.strip()
    title_esc = htmlmod.escape(title_txt)
    # JS埋め込み用に JSON 文字列化(改行・引用符を安全に)
    import json
    body_js = json.dumps(body_html)
    title_js = json.dumps(title_txt)

    page = f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>solomaker貼り付け: {title_esc}</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{ font-family: -apple-system, "Hiragino Sans", sans-serif; max-width: 760px;
         margin: 0 auto; padding: 24px; line-height: 1.8; }}
  .bar {{ position: sticky; top: 0; background: Canvas; padding: 12px 0;
          border-bottom: 1px solid #8884; display: flex; gap: 12px; flex-wrap: wrap;
          align-items: center; }}
  button {{ font-size: 15px; padding: 8px 16px; border-radius: 8px; border: 1px solid #8886;
            cursor: pointer; background: #4ade8033; }}
  button:hover {{ background: #4ade8055; }}
  .hint {{ font-size: 13px; opacity: .7; }}
  .ttl {{ font-weight: 700; font-size: 20px; margin: 16px 0; padding: 12px;
          border: 1px dashed #8888; border-radius: 8px; }}
  hr {{ border: none; border-top: 1px solid #8884; margin: 24px 0; }}
  #body img {{ max-width: 100%; }}
  .ok {{ color: #16a34a; font-weight: 700; }}
</style></head>
<body>
  <div class="bar">
    <button id="bt">① タイトルをコピー</button>
    <button id="bb">② 本文をコピー（見出し付き）</button>
    <span class="hint">→ solomakerの該当欄に貼り付け（⌘V）。本文は見出し/太字/区切りが効きます</span>
    <span id="msg" class="ok"></span>
  </div>
  <div class="ttl" id="title">{title_esc}</div>
  <article id="body" class="prose">{body_html}</article>
<script>
const TITLE = {title_js};
const BODY_HTML = {body_js};
function flash(t){{ const m=document.getElementById('msg'); m.textContent=t; setTimeout(()=>m.textContent='',1800); }}
async function copyHtml(htmlStr, plain){{
  try {{
    await navigator.clipboard.write([new ClipboardItem({{
      'text/html': new Blob([htmlStr], {{type:'text/html'}}),
      'text/plain': new Blob([plain], {{type:'text/plain'}})
    }})]);
    return true;
  }} catch(e) {{
    try {{ await navigator.clipboard.writeText(plain); return true; }} catch(_) {{ return false; }}
  }}
}}
document.getElementById('bt').onclick = async () => {{
  const ok = await navigator.clipboard.writeText(TITLE).then(()=>true).catch(()=>false);
  flash(ok ? '✓ タイトルをコピーしました' : 'コピー失敗（手動選択して）');
}};
document.getElementById('bb').onclick = async () => {{
  const plain = document.getElementById('body').innerText;
  const ok = await copyHtml(BODY_HTML, plain);
  flash(ok ? '✓ 本文をコピーしました（⌘Vで貼り付け）' : 'コピー失敗（手動選択して）');
}};
</script>
</body></html>"""
    Path(out).write_text(page, encoding="utf-8")
    n_h = body_html.count("<h2") + body_html.count("<h3")
    print(f"OK {out}  title={title_txt!r}  h2/h3={n_h}  bytes={len(page)}")


if __name__ == "__main__":
    main()
