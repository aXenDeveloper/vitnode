# Site offline mode with an opening countdown

Status: planned. Owner: core.

## Goals

1. **On/off switch.** An admin turns the whole public site off and on from
   the AdminCP. Turning it off needs a reason.
2. **Reason per language.** The reason is rich text (the Tiptap WYSIWYG), one
   document per language, edited with the existing multi-language editor.
3. **Countdown.** Optionally, the offline page counts down to a planned
   opening time with rolling digits (`SlidingNumber` from
   `@vitnode/core/components/ui/sliding-number`).
4. **Never opens by itself.** When the countdown reaches zero, the page shows
   "Opening soon" and the site stays off until an admin switches it on.
5. **Staff keep working.** Staff browse the site normally while it is off,
   with a banner reminding them that visitors can't. The AdminCP and sign-in
   always work.

Non-goals: scheduled automatic opening, per-section or per-plugin offline
mode, a custom offline page designer, IP allowlists.

## Constraints found in the code

- Site-wide singletons are a one-row table with `id = 1`
  (`core_ai_settings` in `packages/api/src/database/ai.ts`), read through an
  admin `GET /settings` and written through `PUT /settings` with an audit log
  (`modules/admin/ai/routes/*`).
- Multi-language rich text already exists: `MultiLangValue<RichTextDocument>`
  stored as `jsonb` (`core_warnings.message`), edited with
  `<AutoFormEditor format="json" multiLang />` and rendered on the server by
  `RichTextContent` without shipping Tiptap.
- `SlidingNumber` already rolls digits, respects reduced motion and keeps an
  sr-only value.
- The public shell loads in `loadMainShell`
  (`packages/vitnode/src/tanstack/layout/header.tsx`), which already redirects
  suspended sessions (`redirectSuspendedSession`) and renders a gate
  (`SuspensionGate` in `main-header.tsx`). The offline gate follows the same
  shape.
- The page cache stores shared renders that never read a session. An offline
  render must not be served to staff, and an online render must not be served
  after the switch flips.
- New admin APIs require staff permissions (`coreStaffPermissions`).
- `@vitnode/api` must not import from `@vitnode/core`.

## Decisions

| Topic | Decision |
| --- | --- |
| Storage | New singleton table `core_site_status` (`id = 1`). |
| Reason format | `MultiLangValue<RichTextDocument>` in `jsonb`; the default language is required when turning off, others fall back to it. |
| Who passes the gate | All staff (admins and moderators). See open question 1. |
| Countdown end | Client-side only: the countdown swaps to "Opening soon". No cron, no write. |
| Enforcement | Front end gate for every visitor, plus a `503` from public API routes for non-staff (open question 2). |
| HTTP status | Offline page answers `503` with `Retry-After` (when `opensAt` is in the future) and `noindex`. |
| Admin surface | Page `/admin/core/system/site-status` with a status card; editing in a **Sheet** (short settings, per AGENTS.md). |
| Live flip | Realtime event to open offline pages + `refetchInterval` fallback, so visitors see the site as soon as it opens. |
| Permissions | New group `admin.site_status: ["can_view", { can_manage, dependsOn: can_view }]`. |

## Data model

`packages/api/src/database/site-status.ts`:

```ts
export const core_site_status = camelCase.table.withRLS("core_site_status", t => ({
  id: t.integer().primaryKey().default(1),
  offline: t.boolean().notNull().default(false),
  message: t.jsonb().$type<MultiLangValue<RichTextDocument>>().notNull().default([]),
  opensAt: t.timestamp({ withTimezone: true }),          // null = no countdown
  showCountdown: t.boolean().notNull().default(true),
  changedAt: t.timestamp().notNull().defaultNow(),       // when `offline` last flipped
  changedById: t.integer().references(() => core_users.id, { onDelete: "set null" }),
  updatedAt: t.timestamp().notNull().defaultNow().$onUpdate(() => new Date()),
}));
```

Plus a migration (`pnpm db:prepare`). A missing row means online.

## API (`@vitnode/api`)

### Model / helpers

`packages/api/src/lib/site-status/`

- `site-status.schema.ts` - Zod: `zodSiteStatus` (public shape) and
  `zodSiteStatusUpdate` (admin body). `opensAt` must be in the future when
  set; `message` must have a non-empty default-language document when
  `offline` is `true`.
- `load.ts` - `loadSiteStatus(c)`: reads the row through `c.get("cache")`
  (key `core:site-status`, Redis when configured, memory otherwise), so the
  per-request check costs a cache read, not a query.
- `save.ts` - `saveSiteStatus(tx, body, userId)`: upsert, sets `changedAt`
  only when `offline` flips; afterwards expires the cache key, the page-cache
  tag `core:site-status`, emits the event and the realtime message.

### Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/core/site-status` (public) | everyone | `{ offline, message, opensAt, showCountdown, serverNow }`. When online returns `{ offline: false }` only. Tagged `core:site-status` for the page cache. `serverNow` lets the countdown correct client clock skew. |
| `GET /api/core/admin/site-status` | `site_status.can_view` | The full row plus `changedAt` and who changed it. |
| `PUT /api/core/admin/site-status` | `site_status.can_manage` | Save settings and the switch. Audit log `settings.updated`, target `site-status`. |

The `routeMiddlewareSchema` (`show-config`) gains `siteOffline: boolean`, so
the shell knows the state from the request it already makes, without a second
round trip.

### Enforcement (open question 2)

`siteOfflineMiddleware` after `globalMiddleware`: when offline and the
request has no staff user, public API routes answer
`503 { code: "site_offline" }`. Always allowed: auth and session routes,
`site-status`, `show-config`, i18n/languages, captcha, admin modules, files
needed by the offline page, cron/queue/webhooks (payments). Plugins can opt
a route in with `allowWhenOffline: true` on `buildRoute`.

### Event

`site.status.updated` - `{ offline, opensAt, changedById }`, after commit.
Exported as `siteStatusUpdatedEvent` from `@vitnode/api/events/site`.
Documented in `apps/web/content/docs/dev/events/built-in-events.mdx`.

## Front end (`@vitnode/core`)

### Public gate

`packages/vitnode/src/tanstack/site-status/`

- `query.ts` - `siteStatusQueryOptions()` with
  `fetcher({ plugin: "@vitnode/core", method: "get", module: "site-status", path: "/" })`.
  When offline: `refetchInterval: 60_000`, plus invalidation on the realtime
  `site.status` message.
- `gate.ts` - `redirectOfflineSite(queryClient, location)` called from
  `loadMainShell`, next to `redirectSuspendedSession`. Non-staff on any path
  except the sign-in pages see the offline screen. Instead of a redirect to a
  new URL the shell renders the offline screen in place, so the visitor's URL
  survives the reopening.
- `offline-screen.tsx` - the page (below). Sets `503`, `Retry-After`, and
  `<meta name="robots" content="noindex">` through `head`.
- `staff-banner.tsx` - for staff while offline: an `Alert variant="warning"`
  under the header, "The site is offline. Only staff can see it." with a
  link to the AdminCP page.

### Offline screen

Mobile-first, centered, `main` landmark, semantic tokens only:

```
        [site logo]
   We're offline for a bit          <- h1, text-balance
   <reason rich text, current UI language, falls back to default language>

   ┌────┐ ┌────┐ ┌────┐ ┌────┐
   │ 02 │ │ 14 │ │ 37 │ │ 05 │     <- SlidingNumber, tabular-nums
   └────┘ └────┘ └────┘ └────┘
    days   hours  mins   secs

   Staff sign in →                   <- text link, underline on hover
```

- `countdown.tsx` - `Countdown({ opensAt, serverNow })`: one
  `useSyncExternalStore` ticking every second (one interval for the whole
  component, cleared on unmount, paused when the tab is hidden). Each unit
  is a card with a `SlidingNumber` and its label; units above zero only
  (days hide at 0). Clock skew is corrected with `serverNow - Date.now()` at
  load.
- SSR renders the digits from `serverNow`, so hydration matches and the
  first paint already shows the right time.
- At zero: the digits fade out (`opacity` only, `motion-safe:`) and
  "Opening soon" with a pulsing dot appears. Nothing else changes; the
  query keeps polling so the page reloads into the site once an admin opens
  it.
- Accessibility: the visible digits are `aria-hidden` (`SlidingNumber`
  already does it); one `role="timer"` region with an sr-only label that
  updates once per minute, not every second, so screen readers aren't
  flooded. "Opening soon" is announced through `role="status"`.
- Reduced motion: `SlidingNumber` jumps instead of rolling.

### AdminCP

- Nav: "Site status" under **System**
  (`views/admin/layouts/sidebar/nav/nav-model.tsx`), icon `PowerIcon`,
  permission `site_status.can_view`. Route in `routes.tsx`:
  `page("/admin/core/system/site-status", ...)` with a
  `tanstack/admin/site-status/route.ts` loader that checks the permission
  and warms the admin query.
- Screen (`views/admin/views/core/system/site-status/`):
  - Status card: a large badge (Online / Offline since <date> by <user>),
    the opening time and a live countdown when set.
  - **Turn off site** (`PowerOffIcon`) opens the Sheet with the switch
    already off; **Turn on site** (`PowerIcon`) is a `ConfirmAction`
    ("Visitors will see the site immediately").
  - **Edit message** (`PencilIcon`) opens the same Sheet without flipping.
  - A preview of the public offline screen (the same component, in a
    framed `Card`), so admins see the reason and countdown before saving.
- Sheet form (`AutoForm`, lazy-loaded, `AutoFormSheetFooter`):
  - `offline` - `AutoFormSwitch`
  - `message` - `AutoFormEditor format="json" multiLang`
  - `opensAt` - `AutoFormDateTime`, optional, "Leave empty for no countdown"
  - `showCountdown` - `AutoFormSwitch`, disabled without `opensAt`
  - After save: close the Sheet, invalidate the admin and public queries,
    `sonner` toast with a description.
- A dashboard header pill "Site offline" for admins while offline, linking
  to the page (also in the AdminCP top bar so nobody forgets).
- Errors per AGENTS.md: first load failed → `Empty` with `PowerOffIcon` and
  retry; `403` without retry.

### i18n

- `core.site_offline.*` - title, opening soon, units, staff sign in, staff
  banner, sr-only timer label.
- `admin.system.site_status.*` - page title/desc, card, form labels/descs,
  confirm dialog, toasts, load error.
- Added to `packages/api/src/locales/en.json`, then `pnpm i18n:update`.

## Page cache

- The public status response is tagged `core:site-status`; every shared
  render reads it through the shell, so every cached page carries the tag.
  Saving the status hard-invalidates the tag: no stale online page is served
  after switching off, and no stale offline page after switching on.
- While offline, a shared render (no session) produces the offline screen
  and is cacheable for anonymous visitors. A request with cookies is not
  served the shared entry (existing cookie rule), so staff get their own
  render. To verify during implementation: that a shared offline entry is
  never served to a cookie-bearing request; if it can be, mark offline
  renders non-shareable instead.

## Docs

- `apps/web/content/docs/guides/take-your-site-offline.mdx` (or under the
  AdminCP section): turning it off, writing the reason per language, the
  countdown, what staff see, and the `503` behaviour for SEO. Screenshot
  requests via `// Image prompt:` comments.
- Developer section: `allowWhenOffline` on routes, the
  `site.status.updated` event, reading the status with `fetcher`.
- JSDoc on `siteStatusQueryOptions`, `Countdown`, `allowWhenOffline` and the
  event export.

## Phases

0. **Schema + API.** Table, migration, schemas, `loadSiteStatus` with cache,
   public and admin routes, permissions, audit log, event. `show-config`
   gains `siteOffline`.
1. **AdminCP.** Nav item, route, status card, Sheet form with the
   multi-language editor, toasts, dashboard/top-bar pill.
2. **Public gate.** Shell check, offline screen with the reason, staff
   banner, `503` + `noindex`, sign-in exception.
3. **Countdown.** `Countdown` with `SlidingNumber`, skew correction,
   "Opening soon" state, a11y timer, reduced motion, realtime + polling
   reopen.
4. **API lockdown + page cache.** `siteOfflineMiddleware`, allowlist,
   `allowWhenOffline`, cache tag invalidation.
5. **Docs + polish.** MDX pages, events doc, i18n update, `pnpm lint:fix`,
   manual check in the browser (test@test.com), screenshots.
6. **Tests (separate session, after it works).** `saveSiteStatus` rules,
   route `200`/`403`, middleware allowlist and staff pass, countdown unit
   math as a pure function (`remainingParts(opensAt, now)`), offline screen
   DOM (reason, countdown, "Opening soon" at zero).

## Open questions

1. **Who can browse while offline?** Proposed: all staff (admins and
   moderators). Alternatives: admins only, or staff plus roles picked in the
   form.
2. **Block the API too?** Proposed: yes, public API routes answer `503` for
   non-staff, so content can't be read around the offline page. The lighter
   option is a front-end gate only.
3. **Reason required?** Proposed: required in the default language when
   turning off; other languages fall back to it.
