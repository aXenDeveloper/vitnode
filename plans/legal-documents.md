# Legal documents (Terms of Service, Privacy Policy)

Status: implemented (all three milestones). Tests still to write (see the last
section). Owner: core (`@vitnode/api` + `@vitnode/core`).

Staff publish numbered, frozen versions of the Terms of Service and the
Privacy Policy in **AdminCP → System → Legal documents**. Every version is
public, comparable and emailed to every member. Members accept the Terms on
sign-up or on `/legal/accept`; Privacy Policy changes only show a notice.

User docs: `apps/web/content/docs/dev/legal/*`.

## Decisions

- **Two document types, fixed**: `terms`, `privacy`. Versions count from 1 per
  type. `core_legal_versions` rows never change: a trigger rejects updates
  (except `publishedById` being nulled by the FK) and deletes. Fixes are new
  versions.
- **One draft per type** (`core_legal_drafts`, PK `documentType`) with a
  `revision` counter; saving or publishing an older revision is
  `409 LEGAL_DRAFT_CONFLICT`.
- **No overlapping releases**: publishing while a version is scheduled is
  `409 LEGAL_UPCOMING_VERSION_EXISTS`. Effective dates are therefore
  monotonic, and "current" is simply the newest effective version.
- **Required revision**: the newest effective Terms version with
  `requiresAcceptance`. A member owes acceptance while their highest accepted
  version is below it, and then accepts the *current* version. The first
  Terms version always requires acceptance; the Privacy Policy never does
  (DB check constraint).
- **Inactive until the first effective Terms**: no lock, no record, no gate,
  sign-up unchanged. The guard also fails open (logged) when its lookup
  throws, like `siteOfflineGuard`, so an unmigrated install keeps working.
- **Serialization**: publication takes `pg_advisory_xact_lock` on
  `vitnode:legal:<type>`; acceptance and sign-up take it shared, then re-read
  the timeline from the database (not the cache) before writing.
- **Timeline cache**: only dates and acceptance modes are cached (300 s); the
  timeline is resolved against the clock on every read, so a scheduled version
  turns effective on time without invalidation. Publication and the
  `legal-effective` queue task expire it and the page-cache tags
  `core:legal:<type>`.
- **Enforcement**: `buildRoute({ termsAcceptance })`, default `"writes"`
  (blocks POST/PUT/PATCH/DELETE for signed-in members who owe acceptance),
  `"required"` (all methods), `"exempt"` (recovery routes). `/admin/` and
  `adminStaffPermission` routes are skipped. Members send no writes over the
  WebSocket, so the HTTP guard covers every member write path.
- **Recovery routes exempt**: sign-in/up/out, session, SSO and passkey steps,
  password reset/change, e-mail verification, device revocation, time zone,
  presence heartbeat, personal-data export, account deletion, cancel-deletion
  sign-in, cron, payment webhooks, legal routes.
- **Web**: `loadMainShell` redirects to `/legal/accept?returnTo=` (open paths:
  `/legal`, `/terms`, `/privacy`, `/settings/privacy`, `/settings/security`,
  `/settings/devices`, `/login`); `TermsAcceptanceGate` does the same in the
  browser; `fetcherClient` turns a `403 TERMS_ACCEPTANCE_REQUIRED` into a
  window event; `LegalStateSync` refetches the session on that event, on the
  `legal` WebSocket broadcast and at `nextChangeAt`.
- **Acceptance record**: `(userId, versionId)` unique, append-only (trigger),
  server time, the snapshot locale actually shown, the wording (staff label or
  `core.legal.acceptance.default_wording` translated on the server), source.
  Repeats return the first record. Cascade-deleted with the account; exported.
- **Notices**: newest announced version per type (upcoming included), not
  version 1, announced after the member joined, not dismissed; Terms notices
  hide while acceptance is pending. Dismissal is its own table.
- **Locale fallback**: requested → version's `defaultLanguageCode` → first
  available code (sorted). Comparisons pick one shared language.
- **Comparison**: block-level LCS (top-level nodes, list items split out),
  removal/addition runs paired into "changed"; `<ins>`/`<del>` plus text
  labels.
- **Email**: mandatory, through the existing adapter and queue.
  `core_legal_fanouts` row + `legal-fanout` task are written in the
  publication transaction. Fan-out batches of 500 (resumable cursor, `ON
  CONFLICT DO NOTHING`), send batches of 25 claimed with `SKIP LOCKED`,
  idempotency key `vitnode-legal-<versionId>-<userId>`, 5 attempts with
  backoff, eligibility re-checked before each send. Skipped: no address,
  unverified address, pending deletion. "Sent" means accepted by the
  provider. A batch where every send failed sets `incidentAt` and pauses
  5 min. `legal-delivery` cron (every 10 min) restarts broken chains. Manual
  retry resets failed rows. Publishing requires an adapter
  (`409 LEGAL_EMAIL_ADAPTER_MISSING`).
- **Permissions**: `admin.legal.can_view`, `can_edit`, `can_publish`
  (includes retries), `can_view_records` (member addresses and acceptances).

## Verified in this session

End-to-end against Postgres 16 and an SMTP sink (56 checks): feature
inactive before publication; first Terms forced to require acceptance;
version immutability trigger; old session gated; plugin write blocked;
recovery routes open; wrong version 409; concurrent duplicate acceptance
idempotent; sign-up missing/stale/exact version and atomic account +
acceptance; one delivery per member, rerun-safe; newsletter-off members
emailed; informational release creates no obligation; notice + dismissal;
v1→v2 comparison; future required v3, overlap refused, effective on time,
pending v3 with last accepted v1 (two skipped), comparison across skipped
versions; superseded version refused; Privacy never requires acceptance;
locale fallback; provider outage incident; failed list; manual retry clears
the incident. Browser walkthrough of the public pages, sign-up form, gate,
notices, settings history and the AdminCP screens.

## Tests to write

Per AGENTS.md, in a separate session:

- `resolveLegalTimeline` / `pendingTermsOf`: informational after required,
  two skipped versions, future effective date.
- `localizeLegalContent`, `pickLegalLocale`, `pickLegalCompareLocale`.
- `diffLegalDocuments`: additions, removals, paired changes, list items, a
  first version.
- `legalSkipReasonOf`.
- `termsAcceptanceGuard`: writes vs reads, `required`, exempt, guests, admin
  paths, fail-open.
- Routes (postgres): publish (adapter missing, upcoming exists, draft
  conflict, enqueue in the same transaction), accept (409, idempotent),
  sign-up (400/409, atomicity), retry, permission `403`s.
- Delivery (postgres): fan-out rerun keeps one row per member, incident,
  exhausted attempts, stale `sending` reclaim.
- Web: `redirectPendingTerms` open paths, `legalAcceptDestination`, sign-up
  form `terms_changed` outcome.
