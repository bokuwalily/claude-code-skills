// 移行前後で borderRadius と余白(padding/margin/gap)の実数値が変わった箇所を洗い出す。
// 同名の StyleSheet エントリ同士を比較し、トークンを実数に解決して突き合わせる。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.argv[2]
const BASE = process.argv[3]
const RADII_BY_REPO = {
  // アプリごとに Radii の段の実値が違うので、リポジトリで切り替える
  'shukatsu-tracker-app': { 'Radii.xs': 6, 'Radii.sm': 8, 'Radii.md': 10, 'Radii.lg': 12, 'Radii.card': 16, 'Radii.xl': 20, 'Radii.pill': 999 },
  'postwing-app': { 'Radii.xs': 8, 'Radii.sm': 10, 'Radii.md': 12, 'Radii.card': 16, 'Radii.xl': 20, 'Radii.surface': 24, 'Radii.pill': 999 },
}
const TOKENS = {
  'Spacing.half': 2, 'Spacing.one': 4, 'Spacing.two': 8, 'Spacing.three': 16,
  'Spacing.four': 24, 'Spacing.five': 32, 'Spacing.six': 64,
  // konomi
  'S.xxs': 2, 'S.xs': 4, 'S.sm': 8, 'S.md': 12, 'S.lg': 16,
  'S.xl': 20, 'S.xxl': 24, 'S.xxxl': 32, 'S.huge': 48,
  'RADII.xs': 8, 'RADII.sm': 10, 'RADII.md': 12, 'RADII.lg': 18,
  'RADII.xl': 22, 'RADII.card': 28, 'RADII.pill': 999,
  'RADIUS': 22, 'RADIUS_CARD': 28,
}
Object.assign(TOKENS, RADII_BY_REPO[REPO.split('/').pop()] ?? {})

const PROPS = /^\s*(borderRadius|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingVertical|paddingHorizontal|margin|marginTop|marginBottom|marginLeft|marginRight|marginVertical|marginHorizontal|gap|rowGap|columnGap): (.+),$/

const resolve = (raw) => {
  const v = raw.trim()
  if (/^\d+$/.test(v)) return Number(v)
  if (TOKENS[v] != null) return TOKENS[v]
  return null // 式や動的値は比較しない
}

const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' })
const files = git(['diff', '--name-only', BASE, '--', 'src'])
  .trim().split('\n').filter((f) => f.endsWith('.tsx'))

const entries = (src) => {
  const map = new Map()
  const oneLine = /^\s{2}([A-Za-z0-9_]+): \{([^\n}]*)\},$/gm
  const multiLine = /^\s{2}([A-Za-z0-9_]+): \{\n([\s\S]*?)^\s{2}\},$/gm
  for (const m of [...src.matchAll(oneLine), ...src.matchAll(multiLine)]) {
    const inner = new Map()
    for (const line of m[2].split(/[\n,]/).map((x) => '  ' + x.trim() + ',')) {
      const p = line.match(PROPS)
      if (p) inner.set(p[1], resolve(p[2]))
    }
    map.set(m[1], inner)
  }
  return map
}

const findings = []
for (const file of files) {
  let before
  try { before = git(['show', `${BASE}:${file}`]) } catch { continue }
  const after = readFileSync(`${REPO}/${file}`, 'utf8')
  const b = entries(before)
  const a = entries(after)
  for (const [name, props] of b) {
    const now = a.get(name)
    if (!now) continue
    for (const [prop, oldVal] of props) {
      const newVal = now.get(prop)
      if (oldVal == null || newVal == null) continue
      if (oldVal !== newVal) {
        findings.push({ file, name, prop, oldVal, newVal, diff: newVal - oldVal })
      }
    }
  }
}

findings.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
if (!findings.length) {
  console.log('borderRadius / 余白が変わった箇所: なし')
} else {
  console.log('borderRadius / 余白が変わった箇所:')
  for (const f of findings) {
    console.log(`  ${f.diff > 0 ? '+' : ''}${f.diff}px  ${f.file} styles.${f.name}.${f.prop}  ${f.oldVal} -> ${f.newVal}`)
  }
}
