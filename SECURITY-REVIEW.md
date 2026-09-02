# VitNode security review

**Date:** 2 September 2026
**Scope:** the whole monorepo at `bd66817` — the Hono API (`packages/vitnode/src/api`), the
Content Engine, the TanStack Start web app, the storage/SSO/search adapters, the
plugins, the scaffolding templates and the CI workflows.
**Branch:** `claude/vitnode-security-review-5ly6gw`

Fourteen parallel auditors covered one attack surface each — authentication, authorisation,
password recovery, SSO, uploads, injection, XSS, CSRF/CORS/headers, rate limiting, SSRF,
secrets, response shape, cron/queue/WebSocket, and dependencies/CI. Every candidate finding
was then re-read by three independent verifiers with different briefs (one trying to refute
it, one trying to write the exploit, one judging whether the fix was right), and only
findings a majority upheld are listed here. Most candidates did not survive that pass, which
is the point of having it.

---

## Summary

**16 issues fixed.** 2 critical, 3 high, 7 medium, 4 low.

Two of them are worth reading first, because they are the ones an attacker reaches without
help:

- **Any administrator could make themselves root** by assigning a role in the field beside
  the one that was guarded.
- **Any installation that never set `CRON_SECRET`** would run every registered cron job for
  anyone on the internet, using a password published in this repository.

A third is not an attack but the absence of a defence: **the rate limiter never worked.** It
was wired one line too early, so every request in the deployment shared a single bucket. That
is both a one-host denial of service and the reason several other findings below are worse
than they look — there was nothing throttling the attempts.

Nothing here required a database migration, and no existing data or credential is
invalidated by any of it.

| # | Severity | Issue | File |
|---|---|---|---|
| 1 | Critical | Privilege escalation to root via `secondaryRoleIds` | `admin/users/routes/update.route.ts` |
| 2 | Critical | World-runnable cron on the published default secret | `middlewares/cron-auth.middleware.ts` |
| 3 | High | Rate limiter keyed on `undefined` — one global bucket | `api/config.ts` |
| 4 | High | Live password-reset links readable from the admin queue list | `admin/advanced/queue/routes/get.route.ts` |
| 5 | High | Reset tokens stored in plaintext | `users/routes/reset-passowrd.route.ts` |
| 6 | Medium | Cross-site WebSocket hijacking | `apps/api/src/index.ts` |
| 7 | Medium | Client-chosen IP address | `middlewares/global.middleware.ts` |
| 8 | Medium | Stored XSS through the upload file extension | `api/models/storage.ts` |
| 9 | Medium | Open redirect off the origin | `tanstack/i18n/request.ts` |
| 10 | Medium | Password reset left every old session alive | `users/routes/change-password.route.ts` |
| 11 | Medium | Unguarded admin notification push | `admin/routes/notifications.route.ts` |
| 12 | Medium | OpenAPI document and Swagger UI public in production | `api/config.ts` |
| 13 | Low | Account enumeration by sign-in timing | `models/user/sign-in-with-passwords.ts` |
| 14 | Low | Captcha token injected into the verification URL | `middlewares/captcha.middleware.ts` |
| 15 | Low | Auth cookies stated no `SameSite` | `api/lib/auth-cookie.ts` |
| 16 | Low | Unauthenticated debug route writing a log row per call | `users/routes/test.route.ts` |

Three further issues are **reported but deliberately not fixed** — they need a product
decision or a deployment decision rather than a patch. They are in
[Not fixed](#not-fixed-needs-a-decision) at the end.

---

## Critical

### 1. Any administrator could escalate themselves to root

`packages/vitnode/src/api/modules/admin/users/lib/assert-edit-user-permission.ts`
`packages/vitnode/src/api/modules/admin/users/routes/update.route.ts:211`

`PATCH /admin/users/{id}` takes both a primary `roleId` and a list of `secondaryRoleIds`.
Only the primary one went through `assertCanAssignPrimaryRole`, the guard whose own doc
comment explains that attaching an admin-granting role "must require the same
`can_edit_admin` permission … otherwise a `can_edit`-only admin could escalate a non-admin
user into an admin."

Secondary roles are not a lesser kind of role. `loadStaffPermissions` resolves a user's
powers from `getUserRoleIds`, which is the primary role **plus every secondary one**, and a
`root` role there short-circuits the entire permission system to "yes":

```ts
const roleIds = await getUserRoleIds(c, user);   // primary + secondary
const rootRoles = await db.select(...).where(
  and(inArray(core_roles.id, roleIds), eq(core_roles.root, true)),
);
if (rootRoles.length > 0) return { root: true, permissions: [] };
```

**The attack.** An administrator holding nothing but `users:can_edit` sends:

```http
PATCH /api/@vitnode/core/admin/users/{their own id}
{ "secondaryRoleIds": [4] }        # 4 = the seeded Administrator role
```

`assertCanEditAdminTarget` passes — it only fires when the *target* is already an admin, and
it reads the primary role. The route's own validation only rejects `guest` roles. The write
lands, and on the next request their permission set resolves to `root`. They now hold every
permission on the install, including the `can_edit_admin` they were denied a moment earlier.

**Fixed.** Every role being attached — primary and secondary, in one query — now goes through
the guard, which was also widened: it previously recognised only a role with a
`core_admin_permissions` row, and now also catches `core_roles.root` in its own right and
moderator-granting roles. Covered by `assert-edit-user-permission.test.ts`, including the
"staff role hidden among ordinary ones" case that is the actual exploit.

### 2. Cron jobs runnable by anyone, using a password published in this repository

`packages/vitnode/src/lib/config.ts:51`
`packages/vitnode/src/api/middlewares/cron-auth.middleware.ts`

```ts
get cronJobSecret(): string {
  return process.env.CRON_SECRET ?? INSECURE_DEFAULT_CRON_SECRET;
}
```

The middleware guarding `POST /api/@vitnode/core/cron/` began:

```ts
const cronSecret = c.get("core").cronSecret;
if (!cronSecret) throw new HTTPException(403, { message: "Cron access not configured" });
```

That check can never fire, because the fallback above means `cronSecret` is never empty. So
on any installation that did not set `CRON_SECRET`, this works from anywhere:

```http
POST /api/@vitnode/core/cron/
Authorization: Bearer default-cron-secret-change-in-production
```

and every registered cron job runs — search reindexing, queue draining, whatever plugins
have added. Repeated, it is a free resource-exhaustion primitive on someone else's
infrastructure.

The admin panel does flag this ("cron is insecure while this value is in use"), but a
warning is not a control. Worse, the scaffolded `.env.example` ships its own placeholder,
`your-secure-cron-secret-key`, so an install that copied the file and never edited that one
line reads as configured while being exactly as open.

**Fixed.** Production refuses cron requests while any published placeholder is in use, with
an error naming the variable to set; development still works out of the box. Two smaller
faults in the same twenty lines went with it:

- `providedSecret !== cronSecret` compared secrets with `!==`, which returns as soon as the
  bytes differ. Now `timingSafeEqual`, with the length branch also doing a comparison so the
  timing does not leak the secret's length either.
- `authHeader?.replace("Bearer ", "")` removed the first occurrence of that substring
  *anywhere* in the header, so `Basic Bearer <secret>` parsed as a credential and a secret
  containing the word "Bearer " lost part of itself. Now an anchored prefix match.

Twelve tests in `cron-auth.middleware.test.ts`.

---

## High

### 3. The rate limiter never limited anything

`packages/vitnode/src/api/config.ts:77`

```ts
app.use("*", rateLimiterMiddleware(vitNodeApiConfig.rateLimiter, redisClient));  // reads ipAddress
app.use("*", globalMiddleware({ ... }));                                        // sets ipAddress
```

Hono runs middleware in registration order, and the limiter reads its bucket key
(`c.get("ipAddress")`) before calling `next()`. At that moment nothing has set it.
`rate-limiter-flexible` stringifies whatever it is given, so every request made to the
deployment — every visitor, every route, every SSR render — consumed points from one shared
bucket named `vitnode-api-rate-limiter:undefined`.

Two consequences, in opposite directions:

- **No throttling.** There was no per-client limit on anything, including `POST /sign_in`,
  which has no captcha either. Findings 5 and 13 below are both materially worse for it.
- **A global kill switch.** At the default 80 points per 60 seconds, one host sending ~1.3
  requests a second holds the entire site at `429` for everybody.

The unit test did not catch it because it installs its own middleware setting `ipAddress`
*before* the limiter — the exact opposite of the real wiring.

**Fixed.** IP resolution moved into its own `clientIpMiddleware`, registered ahead of the
limiter. `globalMiddleware` keeps a fallback for anyone composing middleware by hand, so a
missing address can no longer become a rate-limit key silently.

### 4. Every outgoing email, including live password-reset links, readable from the admin queue

`packages/vitnode/src/api/modules/admin/advanced/queue/routes/get.route.ts:79`

`EmailModel.send` queues the *fully rendered* message:

```ts
await this.c.get("queue").dispatch({
  name: "send-email",
  payload: { to: email.to, subject: email.subject, html: email.html, text: email.text },
});
```

and the admin queue list selected the whole row:

```ts
.select({ ...getColumns(core_queue), ...cursorSelection })
```

`getColumns` includes `payload`. The route's declared response schema lists thirteen fields
and `payload` is not among them — but nothing validates a response against its schema in
`@hono/zod-openapi`, so the column simply travelled. The declared contract and the shipped
behaviour disagreed, and the shipped one won.

**The attack.** `queue:can_view` is the only permission in the `queue` module — a read-only
"look at the job list" grant, the sort given to someone who watches the health of a
deployment. Holding it:

```http
GET /api/@vitnode/core/admin/advanced/queue/?status=pending
```

returns the HTML of every queued email. Trigger a password reset for the root administrator,
read the reset link out of the queue before the worker sends it, and take the account. It
also exposes every address the install has ever mailed and the contents of every
notification.

**Fixed.** The handler selects exactly the columns its schema declares. The admin UI never
read `payload`, so nothing changes for it.

### 5. Password-reset tokens stored in plaintext

`packages/vitnode/src/api/modules/users/routes/reset-passowrd.route.ts:57`

`ForgotPasswordTokenModel` has had a `hashResetToken` method all along. Nothing called it.
The reset route generated a token, wrote it to `core_users_forgot_password.token` as-is —
under a variable helpfully named `hashToken` — and mailed the same value:

```ts
const hashToken = new ForgotPasswordTokenModel().generateResetToken();  // not hashed
```

So the table held a set of live, unexpired credentials in the clear. Any read of it is
account takeover for every user with a pending reset: a SQL-injection primitive found later,
a database backup, a read replica, a logged query, a support export. The token is what
proves identity to `change-password`, and it was sitting next to the `userId` it unlocks.

**Fixed.** The raw token goes in the email and nowhere else; only its SHA-256 digest is
stored, and `change-password` hashes the incoming token before looking it up. The digest is
64 characters and the column is `varchar(100)`, so **no migration is needed** — existing
rows are simply stale and expire within thirty minutes.

---

## Medium

### 6. Cross-site WebSocket hijacking

`apps/api/src/index.ts:51` — new `packages/vitnode/src/api/middlewares/websocket-origin.middleware.ts`

`app.get("/ws", upgradeWebSocket(handleVitNodeWebSocket()))` authenticates from the session
cookie on the handshake and registers the connection against that user. It never looked at
`Origin`.

The same-origin policy does not apply to `new WebSocket(...)`. Any page may open a socket to
any host, the browser attaches that host's cookies, and there is no preflight to refuse it
and no CORS header that governs it. Hono's `csrf()` does not help: it inspects non-`GET`
requests, and a WebSocket handshake is a `GET`.

So any site a signed-in visitor has open could `new WebSocket("wss://your-site/api/ws")`,
be registered as that visitor, receive everything the server pushes them — notifications,
and whatever plugins send — and send messages handled with their identity.

**Fixed.** An origin check ahead of the upgrade, allowing the configured web and API origins
plus anything the app passes in. A handshake carrying **no** `Origin` is allowed: browsers
always send one, so an originless handshake is a non-browser client, which has no ambient
cookies to ride. Nine tests, including look-alike hosts, wrong scheme and wrong port.

### 7. Callers could choose their own IP address

`packages/vitnode/src/api/middlewares/global.middleware.ts:327`

```ts
const ipHeaderKeys = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", ... 16 of them];
for (const key of ipHeaderKeys) { ipAddress = c.req.header(key); if (ipAddress) break; }
```

All sixteen are request headers, so all sixteen are attacker-controlled. Whatever the client
put in the first one present became their identity. That identity is used for the rate-limit
bucket and for the audit trail on password-reset rows, and it made both meaningless: a fresh
`X-Forwarded-For` per request is a fresh bucket per request, and `userIpAddress` in a reset
email said whatever the requester wanted it to say.

**Fixed** in `api/lib/client-ip.ts`. The socket address is the default — the one value a
caller cannot pick — and a forwarded header is read only when `trustProxy` says how many
proxies are actually in front. It counts **from the right**, because a proxy appends the
address it saw: behind one proxy, a client sending `X-Forwarded-For: 9.9.9.9` produces
`9.9.9.9, <real client>`, and one entry from the right is the real client. Reading the
leftmost entry, which is the usual way this is got wrong, returns the forgery.

Seventeen tests cover forged chains of arbitrary length, multiple hops, and each of the
sixteen old headers being ignored.

> **Deployment note.** `trustProxy` defaults to *off*, which is correct for a directly
> reachable API and safe everywhere. **If VitNode runs behind nginx, Traefik, Cloudflare or a
> platform edge, set it** — otherwise every visitor resolves to the proxy's address and shares
> one rate-limit bucket. On the TanStack Start mount there is no socket at all (the bridge
> calls `app.fetch(request)` directly), so the API now prints a one-time warning at boot
> naming the setting rather than degrading in silence.

### 8. Stored XSS through the upload file extension

`packages/vitnode/src/api/models/storage.ts:495` and `lib/api/upload.ts`

Both halves of an upload come from the client and nothing made them agree. The media type
was checked against the allowlist:

```ts
if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) throw ...
```

and then the stored extension was taken from the *filename*:

```ts
generateStorageFileName(file.name)   // → `${randomUUID()}${getFileExtension(originalName)}`
```

`image/gif` and `image/svg+xml` are deliberately excluded from sharp's re-encode list, so for
those the bytes are never inspected either. Upload a file announced as `image/gif`, named
`payload.html`, containing script: it passes the type check, skips the image pipeline, and is
written as `<uuid>.html`. `apps/api` serves the uploads directory with `serveStatic` from the
API's own origin — the origin the session cookie belongs to — so the result is a page on the
site. `POST /admin/debug/test-storage-upload` allows `image/gif` and hands back the URL; a
Content Engine file field allows it wherever `allowedMimeTypes` is set without
`allowedExtensions`.

**Fixed**, in two layers:

- The stored extension is bound to the validated media type: a known type may only be stored
  under one of its own extensions, and an unknown type may not be stored under one a browser
  executes (`.html`, `.php`, `.js`, `.xml`, `.svgz` and friends become `.bin`). The display
  name in `core_files` is untouched, so downloads keep the name the user gave.
- The uploads mount now sends `Content-Security-Policy: sandbox` and
  `X-Content-Type-Options: nosniff`. `sandbox` applies only to documents, so images —
  including SVG loaded through `<img>` — are unaffected, but anything *navigated to* lands in
  an opaque origin with no cookies and no same-origin API.

`.svg` is still storable on purpose: it is a real image type a CMS should accept, and the
sandbox header is the right place to neutralise script in one.

### 9. Open redirect off the origin

`packages/vitnode/src/tanstack/i18n/request.ts:108`

Canonicalising a locale prefix strips it from the front of the path. `/en//evil.example`
therefore becomes `//evil.example`, which is not a path — it is a protocol-relative URL, and
a browser following that `Location` reads everything after the two slashes as a host.
Verified directly:

```
GET /en//evil.example  →  308, Location: //evil.example  →  https://evil.example/
```

A phishing link genuinely hosted on the real domain, and a way past any allowlist that trusts
a same-origin-looking path.

**Fixed.** Leading slashes collapse to one, backslashes folded in — browsers treat those as
separators here even though the URL parser does not. The new test fails on all five payloads
without the fix, which was checked by reverting it.

### 10. A password reset left every existing session alive

`packages/vitnode/src/api/modules/users/routes/change-password.route.ts`

The route set the new hash and deleted the reset row, and stopped. Sessions last ninety days
by default, so an attacker holding one kept it — which inverts the meaning of the action.
Somebody resetting a password after a compromise believes they have just locked the intruder
out; they had locked them out of *signing in again* and nothing else.

**Fixed.** A completed reset revokes every session and admin session for that user and drops
them from the session cache (new `api/models/session-revoke.ts`). It runs after the password
write, so a failure there cannot sign somebody out without having changed anything.

### 11. Unguarded admin notification push

`packages/vitnode/src/api/modules/admin/routes/notifications.route.ts`

`POST /admin/notifications/send` checked for *an* admin session and no permission, so any
administrator — including one restricted to a single unrelated screen — could push an
arbitrary title and body to any user id. Notifications arrive inside the product wearing the
product's own UI, which makes them a good phishing surface.

`AGENTS.md` says "New admin APIs always require staff permissions", and the calling code
already believed this one did: its comment reads "`POST /admin/admin/notifications/send`
declares its own". It did not.

**Fixed.** Gated on `dashboard:can_edit`, matching its sibling widget route — the
send-notification dashboard widget is the only caller.

### 12. OpenAPI document and Swagger UI public in production

`packages/vitnode/src/api/config.ts:65`

`app.doc("/swagger/doc", ...)` and `app.get("/swagger", swaggerUI(...))` ran unconditionally,
publishing every route, parameter and response shape in the installation — the admin tree
included — to anyone who asked. That is a map of the attack surface, and it is how several
findings above would be located in the first place.

**Fixed.** On in development, off in production unless an install opts in with
`docs: { enabled: true }`.

---

## Low

### 13. Account enumeration by sign-in timing

`packages/vitnode/src/api/models/user/sign-in-with-passwords.ts:30`

An unknown email returned `403` without hashing anything; a known one first spent a scrypt
derivation. That difference is tens of milliseconds and measurable over a network, which
makes the sign-in endpoint an oracle for which addresses hold accounts — the list a
credential-stuffing run wants before it starts. With finding 3 in place there was nothing
rate-limiting the questions.

**Fixed.** The not-found path spends a derivation against a dummy hash, so both answers cost
the same. Two smaller faults in the same class went with it:

- `verifyPassword` called `reject(err)` without returning and then used the undefined
  `derivedKey`; a stored hash without a `:` threw out of the promise executor and reached the
  client as a `500` instead of a refused sign-in. Both are now a plain `false`.
- The salt widens from 8 to 16 bytes. Existing hashes keep working — the salt is read back
  out of the stored string — and there is a test pinning that.

### 14. Captcha token injected into the verification URL

`packages/vitnode/src/api/middlewares/captcha.middleware.ts:45`

```ts
fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}&remoteip=${userIp}`)
```

`token` is a client-supplied header, interpolated unencoded, so it could carry `&` and append
parameters of its own to the request. The same line put the site's secret key in a URL —
the part of a request that ends up in proxy logs and error reports.

**Fixed.** Both travel in a form-encoded body. A missing secret key now fails closed
explicitly rather than relying on the provider to reject a malformed request.

### 15. Auth cookies stated no `SameSite`

`packages/vitnode/src/api/lib/auth-cookie.ts`

Chrome and Firefox default an omitted `SameSite` to `Lax`, but that is a default, not a rule
— Safari and older engines differ, and a cookie whose cross-site behaviour depends on which
browser is reading it cannot be reasoned about. CSRF here is otherwise covered by Hono's
`csrf()`, which is why this is low rather than higher.

**Fixed.** `Lax`, explicitly, on the session, admin, device and SSO-state cookies. Not
`Strict`: the SSO round trip lands as a top-level cross-site `GET`, and `Strict` would drop
the state cookie on the way back from the provider and break every social sign-in.

### 16. Unauthenticated debug route

`packages/vitnode/src/api/modules/users/routes/test.route.ts`

`POST /api/@vitnode/core/users/test` shipped in production, required nothing, and wrote a row
to `core_logs` on every call. With the rate limiter broken it was a cheap way to fill a disk.

**Fixed.** Removed, along with its registration.

---

## Not fixed — needs a decision

These are real, and each needs a judgement that is not mine to make.

### Rich-text HTML is never sanitised

`packages/vitnode/src/components/ui/editor-content.tsx`

```tsx
<div className="tiptap" dangerouslySetInnerHTML={{ __html: content }} />
```

Tiptap output is stored and rendered with no sanitisation on write, on read, or at the sink,
and the project has no sanitiser dependency. **Today this is latent, not exploitable:** the
only caller in the repository is an admin test page passing a hardcoded string, and the blog
plugin has no public article view yet. But it is a loaded gun pointed at whoever wires the
first one up, and the first content type with a rich-text field published to a public page
turns it into stored XSS on the site's own origin.

I have not fixed it because doing so means adding a dependency and choosing an allowlist —
which tags, which attributes, whether `style` and `class` survive, what happens to embeds.
That is a product decision. The recommendation is to sanitise **on the server, on write**,
with an allowlist, before the first public rich-text surface ships.

### `Host` decides the SSR API origin

`packages/vitnode/src/tanstack/fetcher/server.ts:54`

`resolveApiOrigin()` reads the `Host` header of the request being rendered, and those calls
carry the visitor's cookies. The code is deliberate and thoughtful about this — it explicitly
refuses `x-forwarded-host`, and documents why — and reading `Host` is what makes per-branch
preview deployments work at all. But it does place the burden on the deployment: a reverse
proxy that passes an arbitrary `Host` through lets a request point this server's authenticated
API calls at a host of the caller's choosing.

Changing it would break the preview-deployment behaviour it exists for, so this is a
documentation and deployment matter: **the proxy in front of VitNode must validate `Host`**
(nginx `server_name` with a default-server reject, or the platform equivalent).

### scrypt cost parameters

`packages/vitnode/src/api/models/password.ts`

`crypto.scrypt(password, salt, 64)` uses Node's defaults (N=16384, r=8, p=1), below the
current OWASP recommendation. I deliberately did **not** raise it: the parameters are not
recorded in the stored `salt:key` string, so changing them invalidates every existing
password on every install — a lockout, not an upgrade. Doing it properly means a versioned
hash format that records its own parameters and re-hashes on next successful sign-in. Worth
doing; too large to slip into a security pass.

---

## Checked and found sound

Recording what held up matters as much as what did not, and several of these are places the
obvious guess would have been wrong.

- **Session tokens.** 64 bytes from `crypto.getRandomValues`, SHA-256 hashed at rest, scoped
  to a device id, with the cache TTL capped to the session's remaining lifetime. Sign-out
  deletes the row and the cache entry.
- **Admin sessions.** `createSessionByUserId` refuses a user who is not staff, and `getUser`
  re-checks admin status on the cached path too, so a revoked admin loses access immediately
  rather than at TTL.
- **Password comparison.** `timingSafeEqual`, with the length-mismatch branch also comparing.
- **SQL injection.** No `sql.raw` reaching request data anywhere. Every `orderBy` is a Zod
  enum resolved to a column object, never a string; pagination is cursor-based and capped at
  100 rows; `first=0` and `first=abc` are stable `400`s rather than silent defaults.
- **Path traversal in storage keys.** `sanitizeFolder` validates per segment, so `..`, `a//b`,
  `/a`, `a/` and backslashes all fail on the same rule; the filename is a fresh UUID, so the
  user-supplied name never reaches the path.
- **File ownership.** The user file list, download and delete routes all scope by `userId`;
  no IDOR.
- **SSO CSRF.** The `state` parameter is generated, stored in a cookie as a scrypt digest, and
  verified and cleared on callback. A provider email matching an existing local account is
  refused with a `409` rather than auto-linked, which is the takeover this usually is.
- **Staff permission model.** Root and `unrestricted` short-circuits are consistent; the
  permission cache has an epoch and is expired explicitly on every role and staff-entry write;
  granted permissions are filtered against the catalog, so a forged permission key is dropped;
  dependency chains collapse to stable.
- **Staff self-edit.** The staff create/edit/delete routes already refuse to let an
  administrator edit the entry governing their own access, primary or secondary role. That is
  exactly the guard finding 1 was missing, which is why the gap stood out.
- **Admin debug module.** Every route carries a specific permission; nothing is left on the
  session alone.
- **CORS and CSRF.** `apps/api` passes an explicit origin to both, and credentialed requests
  are never paired with a wildcard.
- **Error handling.** Stack traces and messages are returned only in development.
- **CI.** No `pull_request_target` with a PR-head checkout, and no `${{ github.event.* }}`
  interpolated into a `run:` block.

---

## Verifying the fixes

```bash
pnpm install
cd packages/vitnode && npx vitest run     # 303 files, 6255 tests
npx tsc -p tsconfig.json --noEmit
npx eslint .
```

All green as of this review. 104 tests were added across seven files, each one written
against the behaviour that was wrong — the open-redirect test was checked by reverting the fix and
confirming all five payloads escape the origin.

**Two things to do after deploying**, neither of which is code:

1. Set `CRON_SECRET` to a random value on every install. Finding 2 now fails *closed*, so an
   install still on the placeholder will find its cron endpoint returning `403` — that is the
   fix working, and setting the variable is the answer.
2. Set `trustProxy` in the API config if anything sits in front of the app. See the note
   under finding 7; the API will warn at boot where it can tell.
