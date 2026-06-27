# claude-code-skills

**75 battle-tested [Claude Code](https://claude.com/claude-code) skills**, extracted from shipping 20+ iOS apps, web apps and Chrome extensions solo — each one born from a real failure or a workflow repeated enough times to be worth capturing. None are speculative.

A *skill* is a Markdown file (`SKILL.md`) with a `## Procedure / ## Pitfalls / ## Verification` structure. Claude Code loads it automatically and follows it when the situation matches the description. Drop the folders you want into `~/.claude/skills/` and you're done.

> Skill bodies mix English and Japanese prose, but the commands, code and the `description:` trigger are universal. The tables below are in English.

## Categories

- [Claude Code internals — hooks, plugins, cost, model routing](#claude-code-internals--hooks-plugins-cost-model-routing) (21)
- [macOS & launchd](#macos--launchd) (3)
- [Web — Next.js & Vercel](#web--nextjs--vercel) (11)
- [iOS / Expo / App Store](#ios--expo--app-store) (5)
- [Chrome extensions (MV3)](#chrome-extensions-mv3) (2)
- [Cloudflare Workers](#cloudflare-workers) (1)
- [Game dev — Phaser 3](#game-dev--phaser-3) (4)
- [Local & free AI media — image / video / music / TTS / OCR](#local--free-ai-media--image--video--music--tts--ocr) (8)
- [Google APIs & SEO](#google-apis--seo) (3)
- [Automation & content ops](#automation--content-ops) (17)

## Claude Code internals — hooks, plugins, cost, model routing

| Skill | Use when |
|---|---|
| [`agents-tools-quoted-json`](skills/agents-tools-quoted-json/SKILL.md) | When agent frontmatter tools: fields are inconsistent bare-bracket or legacy format, normalize them to quoted JSON arrays. |
| [`claude-headless-p-invocation`](skills/claude-headless-p-invocation/SKILL.md) | When running claude -p non-interactively in automation scripts or cron jobs on macOS with token and timeout constraints. |
| [`claude-plugin-context-audit`](skills/claude-plugin-context-audit/SKILL.md) | When session startup is slow or responses miss recent instructions, audit and trim SessionStart context injection sources. |
| [`claude-session-log-to-kb`](skills/claude-session-log-to-kb/SKILL.md) | When setting up a Stop hook to convert Claude Code session logs into a persistent knowledge base automatically. |
| [`codex-cli-setup`](skills/codex-cli-setup/SKILL.md) | When installing and authenticating Codex CLI for non-interactive calls from Bash tools or automation scripts. |
| [`codex-delegation-handoff`](skills/codex-delegation-handoff/SKILL.md) | When delegating to codex exec — structured handoff that prevents timeout, empty output, and wrong-directory writes. |
| [`hook-latency-wrap`](skills/hook-latency-wrap/SKILL.md) | When measuring execution time and failure rate of any Claude Code hook using a transparent bash wrapper. |
| [`hook-log-append-pattern`](skills/hook-log-append-pattern/SKILL.md) | When appending structured JSONL logs from Claude Code Stop or PostToolUse hooks. |
| [`macos-hook-path-timeout`](skills/macos-hook-path-timeout/SKILL.md) | When macOS Claude Code hooks or launchd jobs fail with node: not found or timeout: not found. |
| [`message-display-secrets-mask`](skills/message-display-secrets-mask/SKILL.md) | When implementing a Claude Code MessageDisplay hook to mask secrets and collapse large code blocks before display. |
| [`plugin-cache-leak-axes`](skills/plugin-cache-leak-axes/SKILL.md) | When investigating heavy ~/.claude/plugins/cache bloat with a checklist that avoids deleting live plugins. |
| [`plugin-cache-repair`](skills/plugin-cache-repair/SKILL.md) | When Claude Code fails to start with "Plugin directory does not exist" due to missing cache entries. |
| [`plugins-cache-gc`](skills/plugins-cache-gc/SKILL.md) | When ~/.claude/plugins/cache has grown to GB scale and needs safe removal of stale plugin generations. |
| [`prune-plugin-clone-temp`](skills/prune-plugin-clone-temp/SKILL.md) | When ~/.claude/plugins/cache is bloated with interrupted temp_subdir_*.clone marketplace remnants. |
| [`implementation-model-routing`](skills/implementation-model-routing/SKILL.md) | When starting any implementation task, route rote work to Sonnet and keep design judgment in Opus. |
| [`autonomous-build-verify`](skills/autonomous-build-verify/SKILL.md) | When verifying autonomous session output before declaring completion, preventing dummy data or undeployed changes. |
| [`session-handoff`](skills/session-handoff/SKILL.md) | When the context window is nearly full mid-session, snapshot progress and prepare a structured next-session handoff. |
| [`ccusage-cli-cost-tracking`](skills/ccusage-cli-cost-tracking/SKILL.md) | When tracking Claude MAX quota consumption by day or week and displaying it in a statusline. |
| [`transcript-usage-cost-tally`](skills/transcript-usage-cost-tally/SKILL.md) | When tallying per-session token costs from transcript JSONL via Stop hook with official USD pricing. |
| [`self-fusion-multimodel-panel`](skills/self-fusion-multimodel-panel/SKILL.md) | When running local multi-model consensus without paid OpenRouter — Claude views plus Codex as a judgment panel. |
| [`project-exploration-patterns`](skills/project-exploration-patterns/SKILL.md) | When entering an unfamiliar codebase and need fast orientation using ls, grep, find, and tree patterns. |

## macOS & launchd

| Skill | Use when |
|---|---|
| [`cron-to-launchd-macos`](skills/cron-to-launchd-macos/SKILL.md) | When crontab jobs silently never run on macOS Sequoia/Tahoe — migrate them to launchd plist. |
| [`launchd-exit78-exconfig-debug`](skills/launchd-exit78-exconfig-debug/SKILL.md) | When a launchd job loops with exit code 78 (EX_CONFIG) and never actually spawns a process. |
| [`codesign-keychain-prompt-fix`](skills/codesign-keychain-prompt-fix/SKILL.md) | When iOS codesign keychain dialogs block or hang during fastlane or xcodebuild, especially with concurrent builds. |

## Web — Next.js & Vercel

| Skill | Use when |
|---|---|
| [`nextjs-rsc-payload-slim`](skills/nextjs-rsc-payload-slim/SKILL.md) | When Next.js App Router pages have heavy RSC flight payloads from unfiltered DB selects slowing LCP. |
| [`responsive-overflow-guard`](skills/responsive-overflow-guard/SKILL.md) | When editing frontend CSS or Tailwind, auto-detect and fix mobile horizontal scroll overflow before it's reported. |
| [`original-favicon-generation`](skills/original-favicon-generation/SKILL.md) | When creating original favicons for a web app without ImageMagick, using only sharp and png-to-ico. |
| [`tsc-build-check`](skills/tsc-build-check/SKILL.md) | When running pre-commit TypeScript type-check and production build verification in a Next.js or TS project. |
| [`vercel-commit-author-blocked`](skills/vercel-commit-author-blocked/SKILL.md) | When a Vercel deployment stalls at UNKNOWN after a git author change due to COMMIT_AUTHOR_REQUIRED blocking. |
| [`vercel-prod-ship`](skills/vercel-prod-ship/SKILL.md) | When deploying to Vercel production, assigning the alias, and confirming the live URL end-to-end. |
| [`vercel-ssr-5xx-cold-render-diagnosis`](skills/vercel-ssr-5xx-cold-render-diagnosis/SKILL.md) | When curl returns 200 but Google Search Console live tests return 5xx, diagnosing cold-render or jsdom failures. |
| [`vercel-dns-catchall-email`](skills/vercel-dns-catchall-email/SKILL.md) | When adding free catch-all email forwarding to a Vercel-managed domain via Forward Email DNS records. |
| [`nextauth-local-e2e-session`](skills/nextauth-local-e2e-session/SKILL.md) | When running Playwright E2E tests locally against a next-auth Google OAuth app without touching production DB. |
| [`webapp-legal-contact-pages`](skills/webapp-legal-contact-pages/SKILL.md) | When adding LP, contact form, privacy policy, and terms pages to a new webapp or web game. |
| [`xff-ip-dedup-bypass`](skills/xff-ip-dedup-bypass/SKILL.md) | When reviewing rate-limiting code that trusts the leftmost X-Forwarded-For entry, which clients can spoof. |

## iOS / Expo / App Store

| Skill | Use when |
|---|---|
| [`asc-api-app-store-submit`](skills/asc-api-app-store-submit/SKILL.md) | When submitting iOS apps to App Store Connect or checking review status without Apple login or 2FA. |
| [`expo-free-local-ios-testflight`](skills/expo-free-local-ios-testflight/SKILL.md) | When EAS free iOS build quota is exhausted, build and submit to TestFlight locally via manual signing. |
| [`ios-permission-key-security-matrix`](skills/ios-permission-key-security-matrix/SKILL.md) | When security-reviewing iOS project.yml or Info.plist diffs to classify each NSXxx key by access level. |
| [`ios-sim-store-screenshots`](skills/ios-sim-store-screenshots/SKILL.md) | When capturing App Store screenshots from an iOS simulator and compositing them into marketing frames with PIL. |
| [`webapp-to-expo-ios-2repo`](skills/webapp-to-expo-ios-2repo/SKILL.md) | When porting a Next.js+Turso web SaaS to iOS native using a two-repo Expo client strategy. |

## Chrome extensions (MV3)

| Skill | Use when |
|---|---|
| [`chrome-ext-mv3-programmatic-inject`](skills/chrome-ext-mv3-programmatic-inject/SKILL.md) | When a Manifest V3 Chrome extension popup throws "Could not establish connection" and needs programmatic content script injection. |
| [`chrome-ext-store-assets`](skills/chrome-ext-store-assets/SKILL.md) | When generating Chrome extension store icons, screenshots, and submission ZIP without rsvg or ImageMagick on macOS. |

## Cloudflare Workers

| Skill | Use when |
|---|---|
| [`cloudflare-workers-do-deploy`](skills/cloudflare-workers-do-deploy/SKILL.md) | When deploying a Cloudflare Workers + Durable Objects + D1 + SPA app on the free tier. |

## Game dev — Phaser 3

| Skill | Use when |
|---|---|
| [`phaser-gameobject-property-conflict`](skills/phaser-gameobject-property-conflict/SKILL.md) | When TypeScript errors appear because custom Phaser GameObject properties clash with built-in names like state or type. |
| [`phaser-scene-restart-text-lifecycle`](skills/phaser-scene-restart-text-lifecycle/SKILL.md) | When Phaser 3 scene restarts produce dangling Text references or unfired delayedCall timers. |
| [`phaser3-scene-debug-console`](skills/phaser3-scene-debug-console/SKILL.md) | When exposing Phaser 3 scene objects to the browser console for deterministic game logic testing. |
| [`phaser-mcp-verify-throttled`](skills/phaser-mcp-verify-throttled/SKILL.md) | When browser MCP automation of a Phaser 3 game stalls because the background tab throttles requestAnimationFrame. |

## Local & free AI media — image / video / music / TTS / OCR

| Skill | Use when |
|---|---|
| [`local-flux-mflux-image-gen`](skills/local-flux-mflux-image-gen/SKILL.md) | When generating unlimited high-quality images locally for free using FLUX.1-schnell via mflux on Apple Silicon. |
| [`local-ai-video-pipeline`](skills/local-ai-video-pipeline/SKILL.md) | When creating AI video locally for free by applying Ken Burns motion to static images with ffmpeg. |
| [`local-music-generation`](skills/local-music-generation/SKILL.md) | When composing background music or tracks locally for free via MIDI arrangement and MusicGen on Apple Silicon. |
| [`local-llm-slow-diagnosis`](skills/local-llm-slow-diagnosis/SKILL.md) | When a local LLM on ollama runs abnormally slow even though GPU usage reports 100%. |
| [`voxcpm-tts`](skills/voxcpm-tts/SKILL.md) | When synthesizing voice narration or cloning a voice locally for free for video, podcast, or automation pipelines. |
| [`paddle-ocr`](skills/paddle-ocr/SKILL.md) | When extracting text, bounding boxes, and confidence scores from images or PDFs at scale across 100+ languages. |
| [`openclaw-ollama-setup`](skills/openclaw-ollama-setup/SKILL.md) | When configuring OpenClaw 2026.5+ to use a local Ollama model instead of a cloud LLM provider. |
| [`html-to-pdf-slide-deck`](skills/html-to-pdf-slide-deck/SKILL.md) | When generating a 16:9 slide-deck PDF from HTML for proposals or pitch decks, including the Playwright file:// workaround. |

## Google APIs & SEO

| Skill | Use when |
|---|---|
| [`gcal-oauth-desktop-setup`](skills/gcal-oauth-desktop-setup/SKILL.md) | When setting up OAuth 2.0 Desktop App credentials for Google Calendar API on a personal GCP project. |
| [`gsc-cli-automation`](skills/gsc-cli-automation/SKILL.md) | When operating Google Search Console from the CLI for sitemaps, performance data, or URL inspection. |
| [`ga4-connect-projects`](skills/ga4-connect-projects/SKILL.md) | When connecting Google Analytics 4 to all your web apps by auto-creating properties and injecting measurement IDs. |

## Automation & content ops

| Skill | Use when |
|---|---|
| [`git-commit-helper`](skills/git-commit-helper/SKILL.md) | When composing or validating Conventional Commits messages, or recovering from a commit validator failure. |
| [`git-prepush-secret-remote-check`](skills/git-prepush-secret-remote-check/SKILL.md) | When guarding against pushing to the wrong remote or leaking secrets and PII in staged diffs. |
| [`human-review-gate-shell`](skills/human-review-gate-shell/SKILL.md) | When building a shell script to review batch-generated files interactively with approve, skip, reject, and edit actions. |
| [`llm-content-pipeline-quality-gate`](skills/llm-content-pipeline-quality-gate/SKILL.md) | When building a shell pipeline that generates content with claude -p and rejects below-threshold output automatically. |
| [`content-factory-grounding-dedup`](skills/content-factory-grounding-dedup/SKILL.md) | When generating content grounded in personal activity logs while deduplicating post types and themes. |
| [`excel-filtered-url-http-audit`](skills/excel-filtered-url-http-audit/SKILL.md) | When auditing URLs from a spreadsheet by parallel-fetching pages and checking for specific DOM elements. |
| [`wp-cli-ssh-post-update`](skills/wp-cli-ssh-post-update/SKILL.md) | When bulk-uploading HTML article bodies to WordPress posts via WP-CLI over SSH. |
| [`wp-http-article-audit`](skills/wp-http-article-audit/SKILL.md) | When bulk-fetching WordPress article URLs in parallel to audit CTA placement above the first H2. |
| [`hatena-blogsync-autopost`](skills/hatena-blogsync-autopost/SKILL.md) | When automating Markdown draft publishing to Hatena Blog via blogsync, including Rakuten affiliate link embedding. |
| [`youtube-competitor-decompose`](skills/youtube-competitor-decompose/SKILL.md) | When decomposing a competitor YouTube channel's titles, durations, schedules, and tags using yt-dlp without API quota. |
| [`lottie-skottie-authoring-pitfalls`](skills/lottie-skottie-authoring-pitfalls/SKILL.md) | When hand-authoring Lottie JSON animations and encountering double-offset backgrounds or out-of-composition rendering issues. |
| [`reddit-itch-autopost-gotchas`](skills/reddit-itch-autopost-gotchas/SKILL.md) | When automating Reddit and itch.io promotion, navigating new-account blocks, relative-path requirements, and anti-ban design. |
| [`discord-bot-image-to-claude`](skills/discord-bot-image-to-claude/SKILL.md) | When a Discord gateway bot needs to send image attachments to Claude for vision analysis. |
| [`discord-gateway-resume-dedup`](skills/discord-gateway-resume-dedup/SKILL.md) | When a Discord WebSocket bot replays old commands or double-executes due to RESUME event re-delivery without dedup. |
| [`book-to-skill`](skills/book-to-skill/SKILL.md) | When converting books or documents (PDF, EPUB, DOCX, Markdown) into structured agent skills for Claude. |
| [`codebase-to-course`](skills/codebase-to-course/SKILL.md) | When turning any codebase into an interactive single-page HTML course for non-technical stakeholders. |
| [`nothing-design`](skills/nothing-design/SKILL.md) | When the user explicitly requests "Nothing style" or "Nothing design" to apply the Nothing Phone aesthetic. |

## Install

```bash
# clone, then copy the skills you want
git clone https://github.com/bokuwalily/claude-code-skills
cp -r claude-code-skills/skills/<skill-name> ~/.claude/skills/
```

Claude Code discovers them on the next session. Ask it to do the thing the skill describes and it will pull the skill in.

## Contributing

Issues and PRs welcome — especially additional pitfalls for an existing skill, or a new battle-tested skill that follows the `Procedure / Pitfalls / Verification` shape.

## License

MIT © Lily
