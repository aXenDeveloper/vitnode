# VitNode AI – implementation progress

Development checkpoint for the shared AI system. User-facing docs live in
`apps/web/content/docs/dev/ai/` (index, actions, costs-and-limits, admin,
automatic-alt, fields-and-editor, usage, future).

## Current stage

Stages 1–10 implemented. Final integration verification, review and draft PR.

## Base branch

`refactor/edit_articles` (PR #842, article translation + excerpt) is not in
`canary`. This branch was fast-forwarded onto it so the blog AI work is
extended rather than recreated. The draft PR targets `refactor/edit_articles`.

## Architecture decisions

- Server-only AI code: `packages/vitnode/src/api/lib/ai/`. Tables:
  `packages/vitnode/src/database/ai.ts`, ALT tables in `database/files.ts`.
- Canonical action identity `<pluginId>:<localId>`; `aiActionRef` gives typed
  keys so `c.get("ai").run()` infers input and output.
- Model capabilities are explicit (`capabilities`, default `["text"]`).
  Vision = `image-input`; streaming requires `streaming`; object output
  requires `structured-output`. Nothing is inferred from model names.
- Money: decimal strings, `bigint` fixed point (12 places),
  `numeric(24,12)`. 1 AI point = 0.001 USD (conversion version 1).
- Cost order: provider-reported → effective pricing (admin manual override
  replaces synced/config catalog) → unknown. Unknown is never zero: an unknown
  cost charges the site budget its full reservation.
- Users are charged points only for the call that delivered a valid result.
- Budgets: `core_ai_budget_periods` rows per scope per period (global USD,
  system USD, user points, user×permission daily count), locked in sorted
  `scopeKey` order inside one short transaction; no transaction during
  provider calls; reservation = full upper bound (all retries, steps,
  fallback). Settlement flips `settlement` exactly once under a row lock.
- Persistence via `AiLedger`: `PostgresAiLedger` (production) and
  `MemoryAiLedger` (test seam, same pure rules in `budget.ts`).
- Role policies: any granting role grants; largest allowance wins (never
  summed); user override replaces; root roles unlimited.
- Global defaults: AI on, no site cap, `defaultMonthlyPoints` 0, automatic
  ALT off and refused without a site budget.
- ALT: per-language `core_files_alt` (human/ai origin, file fingerprint),
  one base analysis per fingerprint, translations per language, conditional
  writes that never overwrite human rows. Descriptors carry `alts`; the blog
  resolves occurrence override → file ALT → default language → empty.
- Queue: durable `dedupeKey`, lease recovery, `QueueDeferError` (no attempt
  burned), dedicated `ai` queue worker (2 per minute).
- Field AI: `ai: { action, sourceFields, mode: "suggestion" }` on
  text/textarea, validated at definition and boot; shared assist routes;
  review-before-accept UI with stale-source and newer-edit detection.
- Quick Ask: NDJSON streaming, bounded context, plain-text nodes, one-step
  undo, upper-bound estimate before running.
- Translation freshness: `core_ai_translation_sources` source/target
  fingerprints, recorded only after a save (`onSaved` on the content form).

## Completed

- Stage 1–4: registry, usageCost/pricing, runner, history, budgets, points,
  policies, reservations (commit `40b10c79`).
- Stage 5: AdminCP (overview, models & pricing, actions, access, history,
  settings) and `/settings/ai`; admin/user APIs; maintenance cron (lease
  expiry, cost reconciliation with audited adjustments, retention).
- Stage 6–7: multilingual ALT, resolver, automatic generation, sweep, queue
  reliability, S3/Supabase/Local trusted reads.
- Stage 8: shared AI field assistance (blog excerpt, example plugin article).
- Stage 9: Quick Ask.
- Stage 10: translation freshness and optional pre-publication AI review.
- CI: PostgreSQL service so integration tests run.

## Checks

- `packages/vitnode`: `tsc --noEmit` clean; eslint clean on changed files.
- Core suite with real PostgreSQL: 8469 passed before the last fixes; AI
  suites re-run after every change (see final report for the last full run).
- Real PostgreSQL integration: ledger concurrency (9), routes and
  maintenance (10), ALT end to end (10). Removing the `FOR UPDATE` lock makes
  the concurrency tests fail (mutation-checked).
- Blog plugin: tsc clean, eslint clean, 22 tests passed.
- Browser (Playwright, Chromium): all six AdminCP AI pages and `/settings/ai`
  render at 1280px and 390px without horizontal scroll.
- Docs: all AI pages compile as MDX; prettier clean.

## Known limitations

- Streaming does not retry or fall back once a stream has started.
- Gateway prices sync only when an admin clicks "Sync gateway prices".
  Synced prices have no long-context tiers; use a manual override for them.
- ALT base descriptions are written in English, then translated.
- A crash mid-call may pay for one repeated call; exactly-once is not
  promised. Uncertain calls are settled by maintenance at full reservation
  and corrected if the provider reports the billed cost later.
- The AdminCP assist/translation-source routes rely on the action's AI
  permission + `authorize()` / content `can_edit` instead of a separate
  `ai:*` staff permission (documented in code).
- Long-context price tiers can't be edited in the AdminCP (kept as is).

## Next task

Final full-suite run, diff review, draft PR against `refactor/edit_articles`.
