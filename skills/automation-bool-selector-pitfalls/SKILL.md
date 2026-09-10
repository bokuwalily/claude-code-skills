---
name: automation-bool-selector-pitfalls
description: Webブラウザ自動化スクリプト（Playwright/Puppeteer/Selenium）で何日も止まっていたレーンの真因になりやすい2大手抜き＝「booleanの戻り値抜け」と「document全体を走査するセレクタ」の診断・修正パターン。social-autolike/note-autolike/tiktok-autopost等の自動化レーンが突然失敗し始めたときに最初に確認する。
author: auto
created: 2026-08-09
version: 1.0.0
tags: [playwright, automation, debug, web, selector, boolean]
related: [web-automation-false-success-guard, automation-stale-cooldown-flag]
---

## 背景

2026-08-09 hot.md 28h窓（71件）の横断診断結果：
**何日も止まっていたレーンの真因が、ほぼ全部たった2つの手抜きだった。**

| # | パターン | 症状 | 該当レーン例 |
|---|---------|------|------------|
| 1 | boolean の戻り値抜け | アクション成功なのに呼び出し元が失敗と判定 → ABORT連鎖 | social-autolike, note-autolike |
| 2 | document 全体を走査するセレクタ | 意図しない要素にヒット → クリック先間違い・NoSuchElement | ai-portraits/swim, tiktok-autopost |

---

## Pitfall 1: boolean の戻り値抜け

### 症状

```
[ABORT] action returned falsy — skipping
[ABORT] 3回とも失敗
```

スクリプト本体は正常終了しているのに、呼び出し元が `if result:` で falsy を受け取り失敗扱いにする。

### 原因パターン

```python
# NG: return がない（None を返す）
def click_like_button(page):
    page.click('.like-btn')
    # ← return True がない

# NG: 最後の式が代入（値を返さない）
def check_logged_in(page):
    status = page.is_visible('#user-icon')
    # ← return status がない
```

```javascript
// NG: async 関数で return なし
async function performLike(page) {
  await page.click('[data-testid="like"]');
  // ← return true がない
}
```

### 修正

```python
# OK: 明示的 return
def click_like_button(page) -> bool:
    try:
        page.click('.like-btn')
        return True
    except Exception:
        return False

def check_logged_in(page) -> bool:
    return page.is_visible('#user-icon')
```

```javascript
// OK
async function performLike(page) {
  await page.click('[data-testid="like"]');
  return true;
}
```

### 診断コマンド

```bash
# Python: return 抜けを疑うパターン検索
grep -n "def \(click\|check\|do\|run\|perform\|execute\)" TARGET.py | \
  while IFS=: read file lineno rest; do
    end=$((lineno + 15))
    awk "NR>=$lineno && NR<=$end" "$file"
    echo "---"
  done

# 戻り値を使っているのに None の可能性
grep -n "if.*result\|if not result\|return.*action\|result = " TARGET.py
```

---

## Pitfall 2: document 全体を走査するセレクタ

### 症状

```
[ERROR] ElementClickInterceptedException: element is not interactable
[ERROR] clicked wrong element — expected modal button, got header button
[WARN]  multiple elements match, using first
```

「ボタンをクリックしたはずが別のボタンを押していた」「モーダルの外の要素が先にヒットした」。

### 原因パターン

```python
# NG: document 全体から最初にマッチした button
page.click('button.submit')           # ← ページ内に複数ある場合は危険
page.find_element(By.CSS_SELECTOR, '.btn-primary')  # ← どの .btn-primary？

# NG: テキストマッチも document全体
page.get_by_text('送信')              # ← 同テキストが複数箇所にある
```

```javascript
// NG
const btn = document.querySelector('button[type="submit"]');
// ← フォームが複数あると最初のものにヒット
```

### 修正：スコープを限定する

```python
# OK: 親コンテナを先に特定してから検索
modal = page.locator('[role="dialog"]')
modal.get_by_role('button', name='送信').click()  # modal内だけ検索

# OK: より具体的なセレクタ
page.click('#post-form button[type="submit"]')

# OK: nth-of-type / filter で絞り込み
page.locator('button.like-btn').filter(has_text='いいね').first().click()
```

```javascript
// OK: 親要素のコンテキストで検索
const form = document.getElementById('post-form');
const btn = form.querySelector('button[type="submit"]');
```

### 診断コマンド

```bash
# Playwright: スコープなしの危険なセレクタパターンを検索
grep -n "page\.click\|page\.locator\|find_element" TARGET.py | \
  grep -v "locator.*locator\|#\|nth\|filter\|within"

# 同じセレクタが複数ヒットするか確認（Playwright REPL）
# page.locator('button.submit').count()  → 1 以外ならスコープ絞り必要
```

---

## 診断チェックリスト（レーン ABORT 時に最初に確認）

```
□ 1. 失敗している関数/メソッドが bool を返しているか？
      grep -n "def " SCRIPT.py | xargs ... (return True/False があるか)

□ 2. 呼び出し元が戻り値をどう扱っているか？
      if result: / if not result: / assert result で受け取っていないか確認

□ 3. 使用セレクタのスコープは十分に限定されているか？
      page.click('.btn') → page.click('#container .btn') 等に絞り込めるか

□ 4. 同セレクタで複数マッチが起きないか実行時に確認
      count() / find_elements() の長さで多重マッチを検出

□ 5. DOM 構造が変化していないか（サイト改修）
      同セレクタで headless-off モードで目視確認
```

---

## Pitfall 3（派生）: async 関数の await 忘れ

boolean 抜けと同時に発生しやすい。

```python
# NG: coroutine オブジェクトを返す（truthy だが実行されていない）
result = click_like_button(page)   # async def だが await なし
if result:  # coroutine object は常に truthy → 常に成功と誤認
    ...
```

```python
# OK
result = await click_like_button(page)
```

---

## 関連スキル

-  — 成功したように見えて失敗している全パターン
-  — クールダウンフラグ stale による誤 ABORT
-  — 同パターンの会話ログ処理フロー
