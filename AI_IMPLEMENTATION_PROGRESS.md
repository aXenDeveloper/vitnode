# VitNode AI – implementation progress

Development checkpoint for the shared AI system. User-facing docs live in
`apps/web/content/docs/dev/ai/`.

## Current stage

Stage 5 – AdminCP and account usage UI (next). Stages 1–4 core done.

## Base branch

`refactor/edit_articles` (PR #842, article translation + excerpt) is not in
`canary`. This branch was fast-forwarded onto it so the blog AI work is
extended rather than recreated. The draft PR is stacked on
`refactor/edit_articles`.

## Architecture decisions

- Server-only AI code lives in `packages/vitnode/src/api/lib/ai/`.
  Tables in `packages/vitnode/src/database/ai.ts`.
- Canonical action identity: `<pluginId>:<localId>`, e.g.
  `@vitnode/blog:excerpt.generate`.
- Model capabilities are explicit config metadata (`capabilities`), default
  `["text"]`. Vision is `image-input`; image generation stays `imageModel()`.
- Money: decimal strings, fixed-point `bigint` arithmetic (12 decimal places),
  PostgreSQL `numeric(24,12)`. 1 AI point = 0.001 USD (conversion version 1).
- Persistence goes through an `AiLedger` interface: `PostgresAiLedger`
  (production, proven with real PostgreSQL concurrency tests) and
  `MemoryAiLedger` (unit-test seam).
- Budgets: one `core_ai_budget_periods` table keyed by `scopeKey` + period
  start (global USD, system USD, user points, user×permission daily count).
  Reservation locks rows in sorted `scopeKey` order inside a short
  transaction; provider calls never run inside a transaction.

## Completed

- Stage 1: `defineAiAction` (`api/lib/ai/action.ts`), capability metadata on
  model entries (`capabilities`, default `["text"]`), `AiActionRegistry`
  with validation (duplicates, defaults, capabilities, unknown lookups),
  `aiActionRef` typed keys, `buildApiPlugin({ aiActions })`, boot-time
  cross-plugin validation (`core.aiActions`). Blog `field.translate` and
  `excerpt.generate` registered.
- Stage 2: `AiUsage`/`AiCost` discriminated union, decimal money
  (`decimal.ts`), pricing rules with cache/tier/flat units (`pricing.ts`),
  provider adapters for AI Gateway and OpenRouter + default
  (`usage-cost.ts`), cost order provider → effective pricing (manual
  override replaces catalog) → unknown.
- Stage 3: `AiRunner` (`runner.ts`) with run / runAsSystem / stream; calls
  recorded before they start (crash → uncertain); retries + fallback;
  output validation; idempotent settlement; stable `AiError` codes;
  `ai.run.completed` / `ai.run.failed` events. Blog routes moved to the
  runner, response contract unchanged; HTML translations validated
  structurally (`html-structure.ts`).
- Stage 4: points (1 pt = 0.001 USD, version 1), global/system/user/daily
  budget periods, rate + concurrency limits, role policy resolution (largest
  allowance, any-role grant, user override, root unlimited), atomic
  reservations in `PostgresAiLedger`.
- Migration `apps/api/migrations/20261003234938_ai_core`.

## Checks

- `packages/vitnode`: `tsc --noEmit` clean; eslint clean on AI files.
- AI unit tests: 68 passed (accounting, registry, runner incl. streaming).
- Type test `action.test-d.ts`: passed.
- Real PostgreSQL integration (`VITNODE_TEST_DATABASE_URL=… vitest run
  src/api/lib/ai/postgres-ledger.integration.test.ts`): 9 passed. Removing
  the `FOR UPDATE` lock makes 2 of them fail (mutation-checked).
- Blog AI route tests: 8 passed.
- Baseline before changes: core suite 8334 passed.

## Known limitations

- Streaming does not retry or fall back once a stream has started.
- Reservations hold the full upper bound up front (all retries and the
  fallback), so no mid-run extension is needed; this is conservative.
- CI has no PostgreSQL service; the integration tests skip without
  `VITNODE_TEST_DATABASE_URL`.

## Next task

Reconciliation + maintenance cron (lease expiry → uncertain, gateway cost
lookup adjustments, history retention), pricing sync, then admin/account
API routes and UI (Stage 5).
