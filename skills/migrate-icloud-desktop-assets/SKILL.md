---
name: migrate-icloud-desktop-assets
description: Safely move media or automation assets out of an iCloud-synced Desktop while preserving legacy paths, producer and consumer behavior, and absolute-path ledgers. Use when Desktop and Documents sync causes file-read failures, cloud placeholders, duplicate posting risk, or a FILEMAP policy requires relocating real directories to a non-synced content root.
metadata:
  author: auto
  created: 2026-08-04
  version: 1.0.0
---

# Migrate iCloud Desktop Assets

## Procedure

1. Read the active `AGENTS.md` and placement policy. Resolve every source and destination to explicit absolute paths.
2. Confirm each source is a real directory and every destination is absent. Capture per-child-directory file and media counts before moving.
3. For each pair, run `mv <source> <destination> && ln -s <destination> <source>` in one command list. Do not use `cp` or `rsync` for same-volume moves.
4. Update every producer output root, its docstring, all consumer roots and account configuration, and current specs or docs.
5. Back up each mutable ledger as `.bak`, then mechanically replace the old absolute-path prefix. Include all related media pools whose names share that prefix.
6. Search ignored and tracked JSON, Python, and JavaScript files. Exclude logs and `.bak`, but do not rely on default `rg` ignore behavior.
7. Validate JSON, test the real consumer path, force a full PIL image load from the destination, and compare the post-move counts with the captured pre-move counts.
8. Recheck Desktop after iCloud has had time to react. Inspect any conflict directory before removing it, and use `rmdir` only when it is empty.
9. Commit only task-owned tracked files. Keep ledger backups local and preserve unrelated working-tree changes.

## Pitfalls

- Default `rg` skips gitignored ledgers and state. Use `rg --no-ignore` or the user's exact recursive `grep` command for the final zero-match proof.
- `status` is read-only in zsh. Use a name such as `grep_code` when recording pipeline exits.
- iCloud may recreate an old folder as `<name> 2` after a symlink appears. Treat it as unknown until a direct content and metadata check proves it empty.
- Do not fabricate a missing date directory to satisfy a range-shaped expectation. Preserve the pre-move state and report the pre-existing gap.
- A recursive `grep` over a large development tree can take minutes. Poll the running process instead of treating empty intermediate output as completion.
- An untracked `.bak` is intentional recovery state, not a file to stage automatically.

## Verification

- `ls -ld <legacy-paths>` shows only symlinks pointing to the new root.
- Every pre-existing child directory has the same file count before and after; aggregate media totals also match.
- The consumer returns absolute paths under the new root, and its duplicate filter recognizes rewritten ledger entries.
- PIL `Image.open(path); image.load()` succeeds on a real destination image.
- The final old-prefix search returns zero non-log, non-backup JSON, Python, and JavaScript matches.
- `jq empty` passes for all edited JSON, and `cmp` confirms each ledger equals its backup with only the prefix replacement applied.
- Targeted syntax checks and project tests pass. If code is shipped, local and remote commit hashes match afterward.
