# claude-code-skills

A small, battle-tested collection of [Claude Code](https://claude.com/claude-code) skills for **macOS automation** and **web development**. Each one was extracted from a real failure or a repeated workflow — not written speculatively.

Skills are Markdown files (`SKILL.md`) with a `## Procedure / ## Pitfalls / ## Verification` structure. Drop them into `~/.claude/skills/` and Claude Code picks them up.

## Skills

### macOS / Claude Code infrastructure

| Skill | Use when |
|---|---|
| [`cron-to-launchd-macos`](skills/cron-to-launchd-macos/SKILL.md) | Your `crontab` jobs silently never run on modern macOS (cron daemon is dead). Migrate to `launchd`. |
| [`launchd-exit78-exconfig-debug`](skills/launchd-exit78-exconfig-debug/SKILL.md) | A `launchd` job crash-loops with `last exit code = 78 (EX_CONFIG)` — spawn-stage failure, no logs, no process. |
| [`macos-hook-path-timeout`](skills/macos-hook-path-timeout/SKILL.md) | Claude Code hooks / launchd jobs fail with `node: command not found` or `timeout: not found` (GUI minimal-PATH + missing GNU coreutils). |
| [`hook-latency-wrap`](skills/hook-latency-wrap/SKILL.md) | You want to measure the latency and failure rate of any Claude Code hook with a transparent `$EPOCHREALTIME` wrapper. |

### Web / Next.js

| Skill | Use when |
|---|---|
| [`nextjs-rsc-payload-slim`](skills/nextjs-rsc-payload-slim/SKILL.md) | A Next.js App Router page ships a huge HTML payload / slow LCP because `select('*')` data is serialized into the RSC flight stream. |
| [`responsive-overflow-guard`](skills/responsive-overflow-guard/SKILL.md) | After any layout/CSS/Tailwind change — catch mobile horizontal-overflow and centering bugs *before* the user does, with real-viewport checks. |
| [`original-favicon-generation`](skills/original-favicon-generation/SKILL.md) | Generate an original favicon / app icon with `sharp` + `png-to-ico` only (no ImageMagick), including Next App Router wiring. |

## Install

Copy the skills you want into your skills directory:

```bash
git clone https://github.com/bokuwalily/claude-code-skills.git
cp -r claude-code-skills/skills/* ~/.claude/skills/
```

Or cherry-pick a single skill:

```bash
cp -r claude-code-skills/skills/cron-to-launchd-macos ~/.claude/skills/
```

## Notes

- These were authored for macOS (Apple Silicon) + Claude Code. The web skills assume Next.js App Router + Tailwind, but the diagnosis steps generalize.
- Some skills reference example projects by name — those are just illustrative; the procedures are project-agnostic.
- Contributions and corrections welcome via issues / PRs.

## License

MIT © Lily — see [LICENSE](LICENSE).
