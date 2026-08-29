import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import {
  ADMIN_ENTRY_PATH,
  AdminNotFound,
  adminReturnToFor,
  canEnterAdmin,
  ensureAdminAccess,
  loadAdminMessages,
} from '@vitnode/core/tanstack/admin'

import { adminNav } from '#/lib/admin-nav'
import { pageHead } from '#/lib/page-head'
import { AdminShell } from '#/migration/admin-shell'
import { ErrorActions } from '#/migration/error-actions'

/**
 * The boundary every AdminCP page sits under - the admin session guard, and the
 * shell.
 *
 * Pathless: the leading underscore means it contributes no URL segment, so
 * `routes/_admin/core/index.tsx` is `/admin/core`, guarded, and the guard is
 * this file. A page joins the AdminCP by *where its file lives*, not by
 * remembering to check a session.
 *
 * ## It is not under `_authenticated`, and must not be
 *
 * The AdminCP has its own session, under its own cookie (`vitnode_auth_admin`),
 * with its own model and its own endpoint. Stacking the public guard above this
 * one would bounce an administrator to `/login` for a session the AdminCP does
 * not use - and `AuthState.isAdmin`, which lives on the *public* session, means
 * "may be offered the AdminCP", not "is inside it". Two cookies, two questions.
 *
 * ## Nothing may add a splat or catch-all under here
 *
 * `$.tsx`, `$slug.tsx` or any other catch-all child would consume
 * `/admin/content/*`, which the Content Engine still serves from the Next.js
 * app. `isTanStackOwnedPath` would start answering `true` for it, `MigrationLink`
 * would render a client navigation, and every working content screen would
 * become a TanStack not-found. `src/tests/admin-routes.test.ts` pins that
 * `/admin/content/<anything>` is not owned by this router.
 *
 * ## Why the check is in `beforeLoad`
 *
 * It runs before the loader and long before React, so a visitor without admin
 * access never receives a byte of an AdminCP page - not a flash, not a
 * hydration, not a `useEffect` that redirects afterwards. A component-level
 * check would render the page first and then take it away, which on the server
 * means admin markup already written into the stream.
 *
 * ## A failed read is not a denial
 *
 * `ensureAdminAccess` resolves only for an answer the API actually gave - `200`
 * or `403`. A `429` from the rate limiter, a `500`, an API that is not listening:
 * all three reject, and that rejection is deliberately left to propagate as an
 * ordinary route error.
 *
 * Only `canEnterAdmin` answering `false` sends anybody to `/admin`. Catching the
 * rejection and redirecting instead would sign every administrator out of the
 * AdminCP during an outage and present them with a sign-in form for a session
 * they already hold - which is precisely what the Next.js `getSessionAdminApi()`
 * does today, and precisely what this shape exists to stop.
 *
 * ## What it is not
 *
 * A navigation guard, and only that. `api/config.ts` puts
 * `globalAdminMiddleware()` in front of every request whose path contains
 * `/admin/`, each handler re-checks the staff tables, and
 * `SessionAdminModel.getUser()` re-runs `checkIfUserIsAdmin` against the
 * database on every request - deleting the session the moment the answer turns
 * false. So an administrator who edits this app's cached permission set in
 * devtools gets a visible button and an API that still refuses them. Nothing
 * here is, or may become, the security boundary.
 */
export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ context, location }) => {
    const access = await ensureAdminAccess(context.queryClient)

    if (!canEnterAdmin(access)) {
      // TanStack Router's own control-flow signal: `redirect()` returns a typed
      // redirect object that the router catches and turns into a navigation
      // (or, during SSR, a 302). Throwing it is what stops the guard.
      //
      // `/admin` is a sibling leaf, not a child of this route, so this cannot
      // loop: the sign-in page's own guard only redirects *away* on a granted
      // session, and `sanitizeAdminReturnTo` rejects `/admin` as a target.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        search: { returnTo: adminReturnToFor(location) },
        to: ADMIN_ENTRY_PATH,
      })
    }

    // Merged into the context of everything below, so a child route reads
    // `context.adminAccess` already narrowed to the granted half of the union.
    // It is the same object the guard decided on, from the same cache entry, so
    // a page cannot disagree with the guard that let it render.
    return { adminAccess: access }
  },
  /**
   * The shell's strings, warmed before React renders.
   *
   * `adminNav.namespaces` is the same array `AdminShell` hands the shell, and it
   * has to be: the provider reads back the identical `intlQueryOptions` entry
   * this fills, so warming a different namespace set would fill an entry nobody
   * looks at and cost a round trip on the first paint anyway. It is not a fixed
   * list because it cannot be - a plugin group's headings live under that
   * plugin's own id, and which plugins this installation configured is decided
   * in `src/admin-nav.gen.ts`.
   */
  loader: async ({ context }) => {
    await loadAdminMessages({ ...context, namespaces: adminNav.namespaces })
  },
  /**
   * Stated once for the whole panel rather than on each screen.
   *
   * The AdminCP is behind a session and must never be indexed. Router merges the
   * `head` of every matched route and dedupes `meta` by `name`, preferring the
   * deepest, so an admin screen inherits this by saying nothing - which is
   * exactly what `RouteHeadOptions` describes. A screen's own `pageHead` adds
   * only its title and description.
   */
  head: () => pageHead({ robots: 'noindex, nofollow' }),
  /**
   * The AdminCP's 404, rendered inside the shell.
   *
   * What reaches it is a screen whose loader called `requireAdminPermission`
   * and was refused - the same answer `app/[locale]/admin/(auth)/not-found.tsx`
   * gives in the Next.js AdminCP. Declared here rather than per screen so every
   * one of them answers a missing permission identically.
   *
   * A URL under `/admin` that matches no screen at all does *not* reach this
   * one: with no splat under `_admin` - and there must not be one, see above -
   * such a path matches no route in this subtree, and the router falls back to
   * its own not-found at the root. That is the correct trade, and the cost is
   * paid deliberately: rendering an unmigrated admin URL inside this shell
   * would mean claiming it, and claiming `/admin/content/*` is precisely the
   * failure this stage is shaped to avoid. (The root has no
   * `notFoundComponent` of its own yet, so that fallback is currently the
   * router's bare one - for every unmatched URL in this application, not only
   * admin ones. Giving the root a real 404 page is its own piece of work.)
   */
  notFoundComponent: AdminNotFoundScreen,
  component: AdminLayout,
})

/**
 * The refusal, wearing the panel it was refused inside.
 *
 * ## It mounts the shell itself, and has to
 *
 * A `notFoundComponent` renders *instead of* the component of the route that
 * handles the error, not inside it - so this replaces `AdminLayout`, sidebar
 * and header and palette included. An administrator who opened a screen they
 * lack the permission for would otherwise be dropped onto a bare 404 page with
 * no way back into the AdminCP but the browser's back button, which is not what
 * the Next.js AdminCP does: its `not-found.tsx` sits *under*
 * `admin/(auth)/layout.tsx` and keeps the panel around the message.
 *
 * Mounting `AdminShell` here restores that, and it costs nothing: `beforeLoad`
 * has already resolved the admin session and the loader above has already
 * warmed the shell's messages, so the providers inside read the same two cache
 * entries the working screens read and nothing suspends or fetches again.
 *
 * ## What is bound rather than defaulted
 *
 * `ErrorActions` is this app's binding rather than core's default: `/` is served
 * by the Next.js application on some installs and by this one on others, and
 * only the route tree knows which. It is passed as an element from module scope
 * so the type is stable across renders.
 */
function AdminNotFoundScreen() {
  return (
    <AdminShell>
      <AdminNotFound actions={<ErrorActions />} />
    </AdminShell>
  )
}

/**
 * The AdminCP shell.
 *
 * `AdminShell` is this app's binding of `AdminShellContent` - the sidebar, the
 * command palette, the breadcrumb area, the user menu and the one `<main>` every
 * admin page renders inside. It mounts `AdminPermissionsProvider` itself, from
 * the same admin session query the guard above has already filled, so
 * `AdminStaffPermissionGate` and `useAdminStaffPermission` work identically here
 * and in the Next.js AdminCP. It cannot suspend in practice and nothing below it
 * can suspend at all; see the note on the provider.
 *
 * What `#/migration/admin-shell` adds on top is only what a package cannot
 * answer while half of `/admin/*` is still served by the Next.js application:
 * how a path becomes a navigation, and where the user lookup runs.
 *
 * The guard, the loader and the route options above are the parts that must not
 * move.
 */
function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
