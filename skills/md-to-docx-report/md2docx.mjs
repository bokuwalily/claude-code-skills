import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, AlignmentType, BorderStyle } = require("docx");
const [,, src, out] = process.argv;
let md = fs.readFileSync(src, "utf8");
md = md.replace(/^---\n[\s\S]*?\n---\n/, ""); // frontmatter
const lines = md.split("\n");
const children = [];
const runs = (text) => {
  const parts = []; const re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index) }));
    const t = m[0];
    if (t.startsWith("**")) parts.push(new TextRun({ text: t.slice(2, -2), bold: true }));
    else parts.push(new TextRun({ text: t.slice(1, -1), font: "Menlo" }));
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(new TextRun({ text: text.slice(last) }));
  return parts;
};
const cell = (text, header) => new TableCell({ children: [new Paragraph({ children: runs(text).map(r => header ? new TextRun({ ...r, bold: true }) : r) })], shading: header ? { fill: "EEEEEE" } : undefined });
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!l.trim()) continue;
  if (l.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; } i--;
    const parse = r => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map(s => s.trim());
    const body = rows.filter(r => !/^\|\s*-+/.test(r));
    const trs = body.map((r, ri) => new TableRow({ children: parse(r).map(c => new TableCell({ children: [new Paragraph({ children: runs(c) })], shading: ri === 0 ? { fill: "EEEEEE" } : undefined }) ) }));
    children.push(new Table({ rows: trs, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ text: "" }));
    continue;
  }
  if (/^# /.test(l)) children.push(new Paragraph({ text: l.slice(2), heading: HeadingLevel.TITLE }));
  else if (/^## /.test(l)) children.push(new Paragraph({ text: l.slice(3), heading: HeadingLevel.HEADING_1, spacing: { before: 360 } }));
  else if (/^### /.test(l)) children.push(new Paragraph({ text: l.slice(4), heading: HeadingLevel.HEADING_2, spacing: { before: 240 } }));
  else if (/^---$/.test(l)) continue;
  else if (/^> /.test(l)) children.push(new Paragraph({ children: runs(l.slice(2)).map(r => new TextRun({ ...r, italics: true, color: "555555" })), indent: { left: 400 } }));
  else if (/^- /.test(l)) children.push(new Paragraph({ children: runs(l.slice(2)), bullet: { level: 0 } }));
  else if (/^\d+\. /.test(l)) children.push(new Paragraph({ children: runs(l.replace(/^\d+\. /, "")), numbering: { reference: "num", level: 0 } }));
  else if (/^👉 /.test(l)) children.push(new Paragraph({ children: runs(l), shading: { fill: "FFF6D5" } }));
  else children.push(new Paragraph({ children: runs(l), spacing: { after: 120 } }));
}
const doc = new Document({
  numbering: { config: [{ reference: "num", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }] },
  styles: { default: { document: { run: { font: "Hiragino Sans", size: 20 } } } },
  sections: [{ children }],
});
fs.writeFileSync(out, await Packer.toBuffer(doc));
console.log("wrote", out);
