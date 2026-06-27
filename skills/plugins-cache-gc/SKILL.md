---
name: plugins-cache-gc
description: ~/.claude/plugins/cache/ が GB 級に肥大化したときの安全な掃除手順。temp_git_* と古いプラグイン世代を見極めて削除する
author: auto
created: 2026-05-31
version: 1.0.0
---

## Procedure

### 1. サイズ把握
```bash
du -sh ~/.claude/plugins/cache/
du -sh ~/.claude/plugins/cache/claude-plugins-official/*/ | sort -rh | head -10
ls -d ~/.claude/plugins/cache/temp_git_* 2>/dev/null | wc -l
```

### 2. 安全に削除できるもの

**temp_git_*** (完全に安全)
- Claude Code が git clone 失敗時に残す ghost dir
- mtime が古ければ全部削除可
```bash
rm -rf ~/.claude/plugins/cache/temp_git_*
```

**古いプラグイン世代** (確認後削除)
- `claude-plugins-official/<plugin>/<version>/` が複数並んでいる場合
- 最新版だけ残して旧版削除
```bash
ls ~/.claude/plugins/cache/claude-plugins-official/chrome-devtools-mcp/
# 例: 0.22.0  1.0.1  1.1.0  1.1.1 → 1.1.1 だけ残す
rm -rf ~/.claude/plugins/cache/claude-plugins-official/chrome-devtools-mcp/{0.22.0,1.0.1,1.1.0}
```

## Pitfalls

- **sap-cds-mcp / cds-mcp** のような重複名は同一内容か `diff -rq` で確認してから判断
- `claude-plugins-official/.git/` があれば触らない（再 clone コスト大）
- 削除後に MCP サーバ起動エラーが出たら Claude Code 再起動 → 自動再 fetch される
- node_modules を含むプラグインは 100MB-1GB 級。複数世代併存しがち

## Verification

- `du -sh ~/.claude/plugins/cache/` で削減量確認
- Claude Code で対象 MCP サーバ (chrome-devtools 等) を呼び出して動作確認
- 動かなければ最新版のみ残し再起動でリカバリ可能（cache は再生成される）

## 実績

2026-05-31 Phase 19: 3.0GB → 2.0GB (1.0GB 解放)
- temp_git_* 20個 (92MB) 削除
- chrome-devtools-mcp 旧3世代 (~900MB) 削除
