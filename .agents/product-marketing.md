# Product Marketing Context

**Document version:** v3
**Last updated:** 2026-10-19

## Product Overview
**One-liner:** VitNode is a free, open-source (MIT) platform for community websites: publishing, forums, members, moderation and administration in one app you host yourself.
**What it does:** It gives a site its members, roles, permissions, sign-in, AdminCP, ModCP, search, notifications and AI from the first install. Plugins add the experience on top: a blog, a forum, or something you build. The Content Engine turns one content type definition into a database table, a typed API, AdminCP screens, translations, revisions and search.
**Product category:** Open-source community platform (shelf: forum software / community software / Invision Community and XenForo alternatives). Working category label: "Community-Driven Web Platform".
**Product type:** Self-hosted open-source software (TanStack Start + Hono + Drizzle + PostgreSQL). Canary, pre-1.0 (`create-vitnode-app@canary`).
**Business model:** Free, MIT licence. No paid tier. GitHub Sponsors.

## Target Audience
**Target companies:** Community owners, creators, publishers, open-source projects, gaming groups, membership sites, small teams that want their own site instead of a rented SaaS community.
**Decision-makers:** Whoever sets the site up: a developer, or a non-technical owner working with an AI coding agent.
**Primary use case:** One site that holds content and the people around it, with moderation and admin tools that work without code.
**Jobs to be done:**
- Run a forum or community on my own domain, with my own rules, without licence fees.
- Publish articles in several languages and let members discuss them.
- Build a custom community feature without rebuilding sign-in, roles, admin and moderation.
**Use cases:**
- Forum / discussion community (`@vitnode/forum`)
- Blog / multilingual magazine (`@vitnode/blog`)
- Help center, membership site, gaming guild hub, open-source project hub (existing `/solutions/*` pages)

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Community admin / moderator | Keeping the place healthy, fast moderation, clear permissions | Spam, abuse, tools spread across plugins and Discord bots | AdminCP + ModCP with a reports board, approvals, warnings and penalties, scoped moderator permissions |
| Developer | Not rebuilding auth, admin, permissions again; modern stack; typed APIs | Every community project starts with months of plumbing | Plugins on a typed core: one `defineContentType` gives table, API, admin screens, search, translations |
| Non-technical owner with an AI agent | Getting a real site live without learning a framework | Hosted platforms are rented; self-hosted ones need a developer | Docs written for agents (`llms-full.txt`, per-page `.md`, "Copy implementation prompt"), then daily work in the AdminCP |

## Problems & Pain Points
**Core problem:** A community site ends up stitched together: a CMS for articles, separate forum software, Discord for chat, a login that doesn't match, moderation done by hand.
**Why alternatives fall short:** (hypotheses, verify before public comparison claims)
- Commercial forum suites (Invision Community, XenForo) charge licence fees and run on PHP stacks that are hard to extend in modern ways.
- Discourse is forum-first; publishing articles and custom features sit outside its model.
- WordPress + forum plugins work, but members, permissions and moderation differ per plugin.
- Hosted community SaaS (Circle, Skool) owns the domain, data and pricing.
**What it costs them:** Licence fees, plugin glue, duplicated user bases, moderation time.
**Emotional tension:** Fear of building on a platform they don't control; fear that self-hosting means "I need a developer for everything".

## Competitive Landscape
Comparison set confirmed by the user on 2026-10-19: Invision Community, XenForo, Discourse, Flarum, NodeBB, WordPress + bbPress. Date every competitor fact and keep it in one competitor data file.
**Direct:** Invision Community, XenForo, Discourse, Flarum, NodeBB.
**Secondary:** WordPress + bbPress/BuddyPress, Ghost (publishing + members; not in the comparison set).
**Indirect:** Discord servers, Circle, Skool, Facebook groups.

## Differentiation
**Key differentiators:**
- Content and community in one app: articles, forum topics and comments share members, roles, search, moderation and notifications.
- Content Engine: one definition → table, typed API, AdminCP screens, translations, revisions, scheduling, preview links, live co-editing, approvals, sitemap/hreflang.
- Per-field translations, localized URLs and hreflang built in.
- AI with budgets: actions per feature, per-role points, automatic ALT text, any provider via the Vercel AI SDK.
- Built for AI coding agents: agent-readable docs and copyable implementation prompts.
- MIT, self-hosted, modern TypeScript stack.
**How we do it differently:** A core that already contains the hard parts, plus plugins for the experience.
**Why that's better:** Admins get one panel; developers start from feature work, not plumbing.
**Why customers choose us:** [NEED: real user quotes]

## Objections
| Objection | Response |
|-----------|----------|
| "It's canary, can I trust it?" | Say so openly (CanaryNotice). MIT, open repo, update and security-update checks built into the AdminCP. |
| "I'm not a developer." | Daily work happens in the AdminCP and ModCP. Install and plugins go through an AI coding agent with agent-ready docs. |
| "Can I install plugins from the admin panel?" | Not yet: plugins are added as packages (an agent or developer does it in minutes). Don't claim one-click install. |
| "Does it have 2FA?" | No. Passkeys exist (opt-in). Don't claim 2FA. |

**Anti-persona:** Someone who wants a hosted, zero-maintenance community today with no terminal access at all; enterprise buyers needing SLAs, audit logs, GDPR export.

## Switching Dynamics
**Push:** Licence fees, outdated PHP forum suites, rented SaaS, plugin sprawl.
**Pull:** Free/MIT, modern UI, content + forum in one, AI features with budgets, agents can build on it.
**Habit:** Existing forum data and member base; familiarity with Invision/XenForo AdminCP.
**Anxiety:** Pre-1.0 stability, no migration importers, self-hosting.

## Customer Language
**How they describe the problem:** [NEED: verbatim from users]
**How they describe us:** [NEED: verbatim from users]
**Words to use:** community, members, AdminCP, ModCP, plugin, your domain, open source, self-hosted, roles, permissions, moderation, publish.
**Words to avoid:** "modules" for the extension unit (code uses plugins); "empty platform"/"blank page"; "framework" in hero copy for non-developers; "notifications for replies" (no such notification type yet); "2FA"; "one-click install"; "page builder"; "reactions", "followers" (not built, though the bento currently shows them by the user's choice).
**Glossary:**
| Term | Meaning |
|------|---------|
| Core | `@vitnode/core`: members, roles, auth, AdminCP, ModCP, search, notifications, AI, files, Content Engine |
| Plugin | Package that adds pages, API, content types, admin screens, permissions, events (blog, forum) |
| Content Engine | `defineContentType` system that generates storage, API and admin screens |
| AdminCP | Administration panel at `/admin` |
| ModCP | Front-end moderator panel at `/modcp` |
| Container | Nested tree (e.g. forum sections) with its own approval policy and moderator scope |

## Brand Voice
| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Plain | Short, concrete sentences about what ships | Buzzwords, "unlock", "powerful" | "Tables, typed API and AdminCP screens from one definition." |
| Warm, lightly funny | Small human scenes (meetups, pizza) | Jokes that cost clarity | "Forty-two members, one rooftop and far too much pizza." |
| Honest | Canary status said out loud, no invented features | Hedging every line | "Pricing: $0, forever" |

**Tone by context:**
- Launch: concrete feature + one screenshot.
- Errors: friendly, Tabby the cat.
- Social: dev-to-dev, short.
**Terms we own:** AdminCP, ModCP, Content Engine.
**Never use (and why):** invented features (the user said "please don't lie about features").

## Proof Points
**Metrics:** [NEED: GitHub stars, npm downloads, contributors]
**Customers:** [NEED: real sites running VitNode]
**Testimonials:** [NEED]
**Value themes:**
| Theme | Proof |
|-------|-------|
| Free forever | MIT `LICENSE.md` |
| Agent-ready | `/llms.txt`, `/llms-full.txt`, `/docs/*.md`, "Copy implementation prompt" on docs pages |
| Moderation | ModCP reports board, approvals, scoped moderator permissions |
| Multilingual | Per-field translations, localized slugs, hreflang, translated route paths |

## Goals
**Business goal:** Adoption: installs, GitHub stars, plugin authors, contributors.
**Conversion action:** Install (`create-vitnode-app`) / open the docs; secondary: star on GitHub.
**Current metrics:** [NEED]

## Verified feature inventory (code audit 2026-10-19)
Status key: ✅ implemented, ◐ partial, ✗ not found. Re-verify before claiming anything marked ◐/✗.

**Members & access**
- ✅ Sign-up/sign-in, email verification, password reset; scrypt hashing, hashed HttpOnly sessions
- ✅ SSO: Google, Discord, Facebook + custom OAuth2 adapters
- ✅ Passkeys (opt-in), separate AdminCP passkey sign-in
- ✅ Devices page (revoke a session); admins revoke one/all
- ✅ Roles: primary + secondary, colour, prefix, upload quotas, avatar/cover limits, AI policy
- ✅ Staff permissions for admins and moderators, moderator grants scoped per container
- ✅ Captcha (Turnstile, reCAPTCHA v3), rate limiter (5 categories, Redis), CSRF/origin checks, RLS on core tables
- ✅ Separate AdminCP session with 1 h idle timeout
- ✅ Member profiles at `/users/:nameCode` (avatar, cover, activity timeline); `/settings` (overview, notifications, devices, security, connected accounts, AI)
- ✗ 2FA/TOTP · ✗ account deletion · ✗ GDPR export · ✗ admin audit log · ◐ password policy (length only)

**Moderation (ModCP `/modcp`)**
- ✅ Report button on content; reasons; 20 reports/user/hour
- ✅ Reports board (New / In progress / Done, drag-and-drop), claim/assign, internal notes, activity timeline, content snapshot, resolve/reopen
- ✅ Hide/unhide content without unpublishing
- ✅ Approvals queue (per-container publish/edit policy: immediate or approve), "my submissions"
- ✗ Warnings, points, mutes, bans, suspensions (planned; label "Soon" until built)

**Content Engine**
- ✅ `defineContentType` with 15+ field kinds, generated tables and indexes
- ✅ Per-field localization with fallback, per-language slugs, 308 redirects from old slugs
- ✅ Drafts/publish, scheduled publish/unpublish, revisions with diff + restore, conflict detection
- ✅ Signed preview links, duplication, visibility, reports, threads (nested comments)
- ✅ Live co-editing (Yjs/TipTap): presence, field locks, shared autosaved draft
- ✅ Public write for members, containers (nested trees)
- ✅ SEO/OG fields, canonical, noindex, sitemap, hreflang + x-default
- ✅ Generated AdminCP list/form screens with bulk actions, history, schedule, delivery
- ✅ AI suggestions on fields, translation freshness flags, page cache

**AI**
- ✅ `defineAiAction`; shipped actions: editor rewrite/quick-ask, blog translate/excerpt/review
- ✅ Any provider via Vercel AI SDK; per-action model, fallback, limits
- ✅ Budgets: monthly USD budget, points per role, per-user overrides, daily limits
- ✅ Automatic ALT text (cron + queue)
- ✅ AdminCP overview + history; member AI usage page
- ✗ Semantic/vector search

**Search & discovery**
- ✅ Postgres FTS per language (default), Elasticsearch adapter
- ✅ ⌘K header search with live suggestions, popular, recent
- ✅ `/search` filters (type, author, date, sort, highlights), popularity ranking
- ✅ `/discover` feed; AdminCP index screen (reindex, errors)

**Notifications & realtime**
- ✅ Inbox, bell with live unread count, mark read/archive
- ✅ Email immediate or daily/weekly digest; per-type preferences; admin can lock/mandate types
- ✅ AdminCP notification policies and delivery stats
- ◐ Only one notification type ships (`core.admin_message`); forum/blog publish none. Don't claim reply notifications.
- ✗ Push notifications
- ✅ Multiplexed WebSocket with rooms, Redis pub/sub across instances

**AdminCP (`/admin`)**
- ✅ Dashboard with drag/resize widgets (system updates, notes, send notification; plugins add more)
- ✅ Users (list, edit avatar/cover/name/email), Roles, Moderators, Administrators
- ✅ Generated content screens per plugin (blog posts/categories, forum tree)
- ✅ AI overview, actions, history
- ✅ System: plugins (read-only list, update + security-update checks), integrations status with tests, files (alt text, delete guard), notifications
- ✅ Debug panel: logs, cron (run now), queue, cache, search index, services, AI logs
- ◐ Plugins: no install/enable from UI (package + config)
- Navigation and languages live in `vitnode.config.ts` by design, not planned for the AdminCP (user decision 2026-10-19). Frame as "versioned in code, reviewable in a PR", never as a gap.
- ✗ email settings UI · ✗ page builder

**Widgets**
- ✅ Visual "Edit widgets" mode on public pages (hero, CTA, text, links blocks; plugins add blocks)
- ◐ Zones used only on settings pages and the example plugin

**Plugins**
- ✅ `@vitnode/forum`: `/forum`, sections, topics, nested comments, edit, comment permalinks, pending posts, per-forum approval, moderator grants
- ✅ `@vitnode/blog`: `/blog/:slug` article page; admin posts + categories; SEO checklist, translations, AI actions, live editing
- ◐ Blog has no `/blog` index route and no comments
- ✗ Reactions, followers

**Infrastructure**
- ✅ Storage: local, S3/R2, Supabase; WebP optimisation via sharp
- ✅ Email: Nodemailer, Resend; React Email templates
- ✅ Cron + DB queue (retries, backoff, dedupe), Redis cache with memory fallback, page cache
- ✅ OpenAPI/Swagger (dev), update/security-update channel checks
- ✅ Vercel (Nitro) + self-host guides; ◐ Docker for dev only (Postgres + Redis)

**Developer platform**
- ✅ `create-vitnode-app@canary` (single app / monorepo / API only, Docker, Oxlint, `--plugin` scaffold)
- ✅ `vitnode` CLI: dev, build, start, plugin list/validate, db generate/migrate/push/status, i18n check/create/delete/update/update-ai
- ✅ `buildPlugin`, `buildApiPlugin`, Hono modules, typed fetcher with plugin API registry, typed events (~60 built-in + per content type), cron/queue builders
- ✅ AutoForm (~35 field types), ~120 UI components (Base UI, RTL-ready)
- ✅ ~280 docs pages, `llms.txt`, `llms-full.txt`, `/docs/<page>.md`, Copy Markdown, Open in ChatGPT/Claude/Cursor, "Copy implementation prompt" on 12 guides
- ✗ AGENTS.md/CLAUDE.md in generated apps · ✗ MCP server · ✗ docs page about building with AI coding agents

## Learnings
*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*
| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-10-19 | Compare against Invision Community, XenForo, Discourse, Flarum, NodeBB, WordPress + bbPress | User decision | `/compare/*` pages | active |
| 2026-10-19 | Navigation and languages stay config-only; no AdminCP editor planned | User decision | Feature claims, compare tables | active |
| 2026-10-19 | Audience = admins, developers, and non-technical owners who build with AI agents | User decision | All marketing copy | active |
| 2026-10-19 | Everything VitNode lacks is labelled "Soon" (warnings/bans, 2FA, audit log, data export, webhooks, importers, reactions, followers, admin plugin install). Replaces the earlier "no Soon label" decision | User decision | /compare and solutions pages (not home) | active |
| 2026-10-19 | No "Soon" on the home page: it shows only what ships. Bento Reactions/Followers replaced by Approvals and SEO and sitemap | User decision | Home page | active |
| 2026-09-05 | Never claim features that don't exist | User: "please dont lie about features" | All copy | active |

## Changelog
*Newest first. One line per revision: what changed and why.*
- v3 (2026-10-19) — Unbuilt features are labelled "Soon" everywhere; added /compare pages.
- v2 (2026-10-19) — Confirmed the six-product comparison set; navigation and languages are config-only by design.
- v1 (2026-10-19) — Initial context, drafted from a three-part code audit for the landing page redesign.
