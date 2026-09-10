---
name: web-automation-false-success-guard
description: Web自動投稿・公開スクリプトでの「偽成功」パターンと防止策。HTTP 200 + onboarding リダイレクト誤認・return 0 未検証・ログ空行すり抜けの3類型を記録。post.js/note-publication.js/FC2等で繰り返し発生した実例ベース。
author: auto
created: 2026-07-21
version: 1.0.0
---

## 問題

Web自動投稿スクリプトが「成功」を返しても、実際には投稿されていないケースが複数プロジェクトで発生。
サイレントに偽成功するため、翌日まで気づかない・重複防止ログが空のまま再投稿が起きる。

## 偽成功の3類型

### Type 1: HTTP 200 + リダイレクト先が別ページ（onboarding・ログイン誘導）

**実例**: note.com の新規アカウント
- 記事公開APIが `HTTP 200` を返す
- しかしレスポンスのURLが `note.com/onboarding` へリダイレクト → 実際は公開されていない
- `response.status === 200` だけを見ていると常に成功扱い

```javascript
// NG: ステータスコードだけ確認
if (resp.status === 200) return { success: true };

// OK: URLパターン + ボディ検証を追加
if (resp.status === 200 && !resp.url.includes('/onboarding') && !resp.url.includes('/login')) {
  const body = await resp.json();
  if (body?.data?.id) return { success: true, noteId: body.data.id };
}
return { success: false, reason: `unexpected_url:${resp.url}` };
```

### Type 2: `return 0` / `exit 0` を検証なしに使用（認証未設定時の無言成功）

**実例**: `post_to_fc2.py` — セッション Cookie 未設定時に `return 0` で即終了していた

```python
# NG: 認証チェック前にreturn
def post_article(content):
    if not SESSION_COOKIE:
        return 0  # 成功扱いになってしまう

# OK: 明示的に失敗を返す
def post_article(content):
    if not SESSION_COOKIE:
        raise EnvironmentError("SESSION_COOKIE not set — cannot post")
```

### Type 3: 重複防止ログが空・未書き込みで防止機能ゼロ

**実例**: `posted-works.log` が0行の場合、`grep` チェックが常に「未投稿」と判定して再投稿

```bash
# NG: ログが空の場合を想定していない
if ! grep -qF "$article_id" "$POSTED_LOG"; then
    post_article ...
fi

# OK: ログファイル存在・非空チェックをゲートとして使う
if ; then
    echo "WARN: posted log is empty or missing — skipping post to avoid phantom success" >&2
    exit 1
fi
if ! grep -qF "$article_id" "$POSTED_LOG"; then
    post_article ...
fi
```

## 設計原則（実例から）

`必須要素・多様性はモデル任せにせずコードで保証`

- **多様性**: サムネ配色をモデルに任せると毎回同じ → `color-rotation.json` 永続カウンタで機械ローテ
- **公開成功**: HTTPステータスだけに任せると誤検知 → URLパターン + レスポンスIDの二重確認
- **重複防止**: ログファイルの存在に任せると空ファイルをすり抜ける → 非空確認をゲートに

## チェックリスト（投稿スクリプト作成・レビュー時）

- [ ] HTTP ステータスだけでなく **レスポンスURL** や **ボディのID** を検証しているか
- [ ] 認証未設定時に `return 0` / `exit 0` していないか（`raise` or `exit 1` が正しい）
- [ ] 重複防止ログが **空の場合** に正しく停止するか
- [ ] 公開直後に別エンドポイントで「公開済みか」を確認するヘルスチェックがあるか
- [ ] タイムアウト・無応答を「成功」と混同していないか

## 実装パターン（Node.js / note-publication.js 型）

```javascript
async function verifyPublished(noteId, cookieHeader) {
  // 公開後に記事IDで再取得して確認
  const verifyResp = await fetch(`https://note.com/api/v3/notes/${noteId}`, {
    headers: { Cookie: cookieHeader }
  });
  if (!verifyResp.ok) return false;
  const data = await verifyResp.json();
  return data?.data?.status === 'published';
}

// 公開フロー
const postResp = await publishNote(draft);
if (postResp.status !== 200 || postResp.url.includes('/onboarding')) {
  throw new Error(`publish failed: ${postResp.url}`);
}
const noteId = (await postResp.json())?.data?.id;
if (!noteId || !(await verifyPublished(noteId, cookie))) {
  throw new Error('post returned 200 but note is not publicly visible');
}
```

## 関連スキル

-  — note.com 投稿の全体フロー
-  — Reddit/itch.io の同系統の罠
-  — 公開前に人間ゲートを挟むパターン

## Pitfalls

1. **Playwright でも同じ罠**: `page.goto()` が 200 を返してもリダイレクト先を確認しないと onboarding で終わる
2. **非同期公開**: 投稿APIが即時公開でなくキューイングする場合、ID返却直後はまだ `published` でない → ポーリングが必要
3. **ネットワークエラーを 0 で吸収**: `try { ... } catch { return 0; }` パターンは全エラーを成功に変換する最悪パターン
