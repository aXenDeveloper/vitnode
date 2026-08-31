import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ADMIN_RETURN_TO_PARAM,
  AdminSignInRouteContent,
  canEnterAdmin,
  loadAdminSignInRoute,
  prefetchAdminAccess,
  sanitizeAdminReturnTo,
} from '@vitnode/core/tanstack/admin'

import { internalDestination, useAppNavigate } from '#/lib/navigation'
import { pageHead } from '#/lib/page-head'

/**
 * `/admin` - the AdminCP sign-in screen.
 *
 * **A page, not a layout.** There is no `admin/` directory beside this file and
 * there must not be one:
 *
 * `/admin` is a sign-in form, and `_admin` is the admin-session guard. A nested
 * layout would render the sidebar around the sign-in card and put the guard in
 * front of the page that exists to create a session. Same shape as `/login`
 * against `_authenticated`, for the same reason.
 *
 * As a leaf, `/admin` matches `/admin` and nothing else, so every URL below it
 * is answered by whichever route actually declares it - `/admin/content/blog/posts`
 * by the Content Engine's splat under `_admin`, `/admin/core/users` by its own
 * file, and a URL no route declares by the not-found boundary. Making this a
 * nested layout is one careless index route away from claiming the whole subtree
 * and swallowing all three.
 *
 * No locale prefix, in any language. `DEFAULT_IGNORED_LOCALE_PATHS` lists
 * `/admin` with its descendants, so the rewrite neither strips nor writes one,
 * and `handleLocaleRequest` 308s `/pl/admin` here while attaching the locale
 * cookie to the redirect - which is how arriving by a prefixed URL still records
 * the language. Nothing in this file mentions one.
 */
export const Route = createFileRoute('/admin/')({
  /**
   * Where the administrator was heading before the guard sent them here.
   *
   * Kept as it arrived and judged nowhere near here - `sanitizeAdminReturnTo` is
   * the single answer to whether a target is somewhere this app may navigate to,
   * and it is applied where the value is *used*, inside
   * `AdminSignInRouteContent`. Same split as `/login`.
   */
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo:
      typeof search[ADMIN_RETURN_TO_PARAM] === 'string'
        ? search[ADMIN_RETURN_TO_PARAM]
        : undefined,
  }),
  /**
   * An administrator who already has a session skips the form.
   *
   * `prefetchAdminAccess` rather than `ensureAdminAccess`, and this is the one
   * route where the tolerant read is the correct one. `ensureAdminAccess`
   * rejects when the session cannot be read at all - right for `_admin`, where
   * an outage must not sign anybody out - but here the same rejection would
   * replace the AdminCP's only entrance with an error screen, so a partial
   * outage would leave nobody able to sign in and fix it. A failed read
   * therefore resolves to `undefined` and the form renders.
   *
   * Only a decision the API actually gave redirects anyone. `canEnterAdmin` is
   * true for `granted` alone; `denied` and `undefined` both fall through to the
   * form, which is the honest answer for each.
   *
   * The destination goes through the same two questions `/login` asks, in the
   * same order: `sanitizeAdminReturnTo` decides whether this app may send a
   * browser there at all, and `internalDestination` decides what the router
   * wants to be handed.
   *
   * `to` rather than `href` - a redirect carrying `href` is used verbatim by
   * `Router.resolveRedirect` and never reaches `buildLocation`. That matters
   * less here than on `/login` (an admin URL carries no prefix to lose) but the
   * two guards should not differ in shape for a reason that is not written
   * down.
   */
  beforeLoad: async ({ context, search }) => {
    const access = await prefetchAdminAccess(context.queryClient)
    if (!access || !canEnterAdmin(access)) return

    const href = sanitizeAdminReturnTo(search.returnTo)

    // TanStack Router's own control-flow signal - see the note in
    // `routes/_main/_authenticated.tsx`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(internalDestination(href))
  },
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadAdminSignInRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminSignInRoute,
})

function AdminSignInRoute() {
  return (
    <AdminSignInRouteContent
      navigate={useAppNavigate()}
      returnTo={Route.useSearch().returnTo}
    />
  )
}
