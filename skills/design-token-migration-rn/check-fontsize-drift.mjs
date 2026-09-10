// 移行前後で文字サイズが実際に変わった箇所を洗い出す。
// 変更後の <ThemedText type="X" ... style={styles.NAME}> について、
// 変更前の styles.NAME が持っていた fontSize と、type が意味する fontSize を突き合わせる。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.argv[2]
const BASE = process.argv[3]
const RAMPS = {
  'shukatsu-tracker-app': {
    title: 48, subtitle: 32, heading: 18, default: 16, callout: 15,
    small: 14, smallBold: 14, footnote: 13, caption: 12, captionBold: 12,
    eyebrow: 11, code: 12, link: 14, linkPrimary: 14,
  },
  'postwing-app': {
    display: 60, title: 44, h1: 30, subtitle: 28, h2: 18, default: 16,
    small: 14, smallBold: 14, link: 14, linkPrimary: 14,
    caption: 12, captionBold: 12, code: 12, eyebrow: 11,
  },
}
const RAMP = RAMPS[REPO.split('/').pop()]

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' })
const files = git(['diff', '--name-only', BASE, '--', 'src/app', 'src/components'])
  .trim().split('\n').filter((f) => f.endsWith('.tsx'))

const findings = []

for (const file of files) {
  let before
  try {
    before = git(['show', `${BASE}:${file}`])
  } catch {
    continue // 新規ファイル
  }
  const current = readFileSync(`${REPO}/${file}`, 'utf8')

  const sizesIn = (src) => {
    const map = new Map()
    for (const m of src.matchAll(/^\s{2}([A-Za-z0-9_]+): \{([\s\S]*?)^\s{2}\},/gm)) {
      const fs = m[2].match(/fontSize: (\d+)/)
      if (fs) map.set(m[1], Number(fs[1]))
    }
    return map
  }
  // 変更前: スタイル名 -> fontSize
  const beforeSizes = sizesIn(before)
  // 変更後も同じ名前の style に fontSize が残っていれば、それが実効値(style は type より後に merge される)
  const afterSizes = sizesIn(current)

  // 変更後: ThemedText の type と style={styles.NAME}
  for (const m of current.matchAll(/<ThemedText[^>]*?>/gs)) {
    const tag = m[0]
    const type = tag.match(/type="([a-zA-Z]+)"/)?.[1] ?? 'default'
    const styleName = tag.match(/style=\{styles\.([A-Za-z0-9_]+)\}/)?.[1]
    if (!styleName) continue
    const oldSize = beforeSizes.get(styleName)
    const newSize = afterSizes.get(styleName) ?? RAMP[type]
    if (oldSize == null || newSize == null) continue
    if (oldSize !== newSize) {
      findings.push({ file, styleName, oldSize, newSize, diff: newSize - oldSize })
    }
  }
}

findings.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
if (!findings.length) {
  console.log('文字サイズが変わった箇所: なし')
} else {
  console.log('文字サイズが変わった箇所:')
  for (const f of findings) {
    console.log(`  ${f.diff > 0 ? '+' : ''}${f.diff}px  ${f.file} styles.${f.styleName}  ${f.oldSize} -> ${f.newSize}`)
  }
}
