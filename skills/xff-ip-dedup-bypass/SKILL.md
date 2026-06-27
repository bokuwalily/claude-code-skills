---
name: xff-ip-dedup-bypass
description: IPベースのdedup・レート制限でX-Forwarded-Forの左端エントリを使っているコードをレビューする際、または「IPがクライアント制御でdedup/rate-limitが回避できる」脆弱性を修正する際に発火する
author: auto
created: 2026-06-19
version: 1.0.0
status: active
---

## Procedure

### 1. 脆弱パターンの特定

以下のコードを検索してリスクを確認する。

```bash
# XFFの先頭エントリを取り出しているコードを探す
grep -rn "x-forwarded-for\|X-Forwarded-For" src/ --include="*.ts" --include="*.js"
grep -rn "split(',')[0]\|split(',')\[0\]" src/
```

脆弱なパターン例（クライアントが任意の値を注入可能）:

```ts
// 危険: 左端はクライアント制御
const xff = headers.get('x-forwarded-for')
if (xff) return xff.split(',')[0].trim()
```

空IPのフォールスルーも確認する:

```ts
// 危険: 両ヘッダー不在 → '' → dedup スキップ扱いになっていないか確認
return headers.get('x-real-ip')?.trim() || ''
```

### 2. データフローを追跡する

`clientIp()` / `getClientIp()` の戻り値がどこへ流れるかをgrepで追う:

```bash
grep -rn "clientIp\|getClientIp\|hashIp" src/ --include="*.ts"
```

dedup キー・rate-limit キー・`recordUsage` / `recordClick` 等のsinkに渡っていれば高リスク確定。

### 3. 修正方針

**Option A — 信頼プロキシ数ベースの右端取得（汎用）**

```ts
export function clientIp(headers: Headers, trustedProxies = 1): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map(h => h.trim())
    // 右から trustedProxies 番目を取る（それより左はクライアント注入可能）
    const idx = Math.max(0, hops.length - trustedProxies - 1)
    return hops[idx] || ''
  }
  return headers.get('x-real-ip')?.trim() || ''
}
```

**Option B — エッジ署名済みヘッダーを優先（Cloudflare / Vercel 等）**

```ts
export function clientIp(headers: Headers): string {
  // プロバイダーが署名するヘッダーを最優先
  return (
    headers.get('cf-connecting-ip') ||          // Cloudflare
    headers.get('x-vercel-forwarded-for') ||    // Vercel
    headers.get('x-real-ip') ||
    ''
  )
}
```

**空IPの扱い**: `''` を "dedup スキップ" として扱う実装は禁止。空IPはブロック or エラーにする。

```ts
export function hashIp(ip: string, salt: string): string {
  if (!ip) throw new Error('IP is required for dedup')
  // または: return 'NO_IP_BLOCKED'  として常にブロック扱いにする
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}
```

### 4. 修正後の検証

- `X-Forwarded-For: attacker-ip, real-ip` を送信して、`real-ip` がキーになることを確認
- ヘッダー不在時に dedup がスキップされないことを確認

## Pitfalls

- `x-forwarded-for` の左端はリバースプロキシが **追記** するのではなく、クライアントが **任意に設定できる**。左端を信頼するのは必ず脆弱。
- Vercel / Cloudflare 環境でも `x-forwarded-for` 自体は複数ホップを含むことがある。署名済みヘッダーを使う方が確実。
- `trustedProxies` の数はインフラ構成に依存する。環境変数で設定可能にしておくこと。
- テストで `new Headers({ 'x-forwarded-for': '...' })` をそのまま使うと実際の動作を検証できない（ブラウザ・ランタイムによっては Headers がケース正規化される）。

## Verification

```bash
# 修正後に脆弱パターンが残っていないか確認
grep -rn "split(',')[0]" src/ --include="*.ts"
# 空IPがスキップされていないか確認
grep -rn "return ''" src/lib/ip.ts
# テスト実行
pnpm vitest run tests/ip.test.ts
```
