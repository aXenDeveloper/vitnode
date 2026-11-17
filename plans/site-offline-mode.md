# Site offline mode

Status: implemented. Tests still to write (see the last section). Owner: core.

An admin switches the public site off in **AdminCP → System → Site status**
and writes why, once per language. Visitors get a card with that message and,
if an opening time is set, a countdown. The site never opens by itself: when
the time runs out the card says "Opening soon" until an admin turns the site
back on. Admins, and moderators given the permission, keep using the site.

Out of scope: scheduled automatic opening, offline mode per section or per
plugin, IP allowlists.

## Who gets in

| Viewer | Gets |
| --- | --- |
| Admin, or any AdminCP session | The site, with a "site is offline" banner |
| Moderator with `moderator.site_status.can_access_offline` | The same as an admin |
| Any other moderator, member or guest | The offline card, `503` |
| Anyone on `/login` and below | The sign-in pages, so staff can sign in |

Root roles and unrestricted moderator entries hold the permission without
listing it. Registration stays closed: `/register` is not an open path.

The server makes this call once, in `canBypassSiteOffline`
(`packages/api/src/lib/site-status.server.ts`). The API guard, the SSR `503`
and the client gate all follow it, so they cannot disagree.

## Storage and API

- `core_site_status`: one row, `id = 1`. A missing row means online.
  `message` is `MultiLangValue<RichTextDocument>` in `jsonb`. `changedAt` and
  `changedById` move only when `offline` flips.
- `loadSiteStatus(c)` reads the row once per request and caches it for 300s
  (Redis when configured). A save deletes the entry and hard-invalidates the
  page-cache tag `core:site-status`.
- `GET /site/status` (public, `allowWhenOffline`): offline flag, message,
  opening time, `serverNow` for clock skew, and `viewerCanBypass` for the
  requesting viewer.
- `GET` / `PUT /admin/site/status`: guarded by `admin.site_status.can_view` /
  `can_manage`. The `PUT` requires a non-empty message in the default language
  while offline, refuses a new opening time in the past (an expired one may
  stay), writes an audit entry and emits `site.status.updated`.

## Enforcement

- **API:** `buildRoute` adds `siteOfflineGuard` to every route unless it sets
  `allowWhenOffline` or `adminStaffPermission`. Blocked callers get
  `503 { error: "site_offline" }` with `Retry-After`. Core opts in sign-in,
  password reset, e-mail verification, SSO, passkey sign-in, the session,
  `show-config`, the status itself, cron, payment webhooks and signed content
  previews. Deny by default was the point: a path allowlist would have
  silently exposed every new plugin route.
- **Pages:** `loadMainShell` loads the status keyed by viewer id (signing in
  fetches it again) and answers `503`, `no-store` and `X-Robots-Tag: noindex`
  through `setResponseStatus`. `ThemeLayoutContent` swaps the frame for the
  offline card, so existing apps needed no route changes; `SiteOfflineGate`
  covers custom layouts.
- **Page cache:** it never stores a non-`200` render, so an offline card is
  never cached and a cookie-bearing staff request always gets its own render.
- **Failure:** a status that cannot be read counts as online. A broken lookup
  should not take every route down with it.
- **Reopening:** an open offline card polls every minute and on focus, then
  calls `router.invalidate()` so the page behind it loads its data. No
  realtime push: the socket only serves signed-in users, and the card is for
  guests.

## Offline card (decided from `/proto/offline`)

- **Notice**: one card on a muted page. Logo and a "Maintenance" pill, the
  heading, the message, then one row for the opening time.
- The row shows "Back in 02d 05h 37m 09s" with rolling digits
  (`SlidingNumber`) and the date. With **Show countdown** off it shows the
  date alone. Once the time has passed it shows "Opening soon". No opening
  time, no row.
- The row lays out by the card's width (`@container`), not the viewport, so it
  fits the narrow AdminCP preview.
- No sign-in link and no mention of staff. Staff open `/login` or `/admin`
  directly.
- Rejected:
  - **Centred stack with countdown tiles**: the message and the countdown
    competed, and it read as a product launch, not maintenance.
  - **Editorial split** (left-aligned, ruled countdown list): good for long
    reasons, but on phones the countdown dropped below the fold.
  - **Giant digital clock**: fun for launches, but it buried the reason, and
    "Opening soon" or no time at all left a huge empty hero.

## AdminCP screen (decided from the in-place prototype)

- **Inline**: everything is edited on the page. A status card with the "Take
  the site offline" switch, the multi-language editor, the opening time and
  "Show countdown", next to a sticky live preview of the card (dimmed while
  the site is online).
- A save bar appears only with unsaved changes. Its button names the outcome:
  "Turn off site" (destructive), "Turn on site" or "Save changes". There is no
  extra confirm dialog; the label is the confirmation.
- The form checks the default-language message itself, so the error lands on
  the field instead of coming back as a `400` toast.
- Rejected:
  - **Status card, side sheet and static preview**: the preview could not show
    unsaved edits, and every change took two steps.
  - **Control panel** (big Online/Offline switch, summary rows, preview in a
    dialog): quick to scan, but the message hid behind "Edit" and the preview
    behind a click.

## Debug panel

While the site is offline, the Debug Panel lists a warning ("The public site
is offline until ...") that links to Site status. It counts towards the
warning badge in the AdminCP user bar, so an offline site is hard to forget.

## Tests to write

Per AGENTS.md, in a separate session:

- `canBypassSiteOffline`: admin, moderator with and without the permission,
  guest.
- `siteOfflineGuard`: blocked route `503` with `Retry-After`;
  `allowWhenOffline` and `/admin/` pass.
- `PUT /admin/site/status`: missing default-language message `400`, past
  opening time `400`, expired time kept, `403` without `can_manage`.
- `countdownParts` as a pure function.
- The offline card's DOM: message fallback, countdown, date only,
  "Opening soon".
