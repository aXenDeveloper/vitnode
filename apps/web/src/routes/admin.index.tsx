import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ADMIN_RETURN_TO_PARAM,
  AdminSignInRouteContent,
  canEnterAdmin,
  loadAdminSignInRoute,
  prefetchAdminAccess,
  sanitizeAdminReturnTo,
} from '@vitnode/core/tanstack/admin'

import { pageHead } from '#/lib/page-head'
import {
  migrationNavigateOptions,
  resolveMigrationDestination,
  useMigrationNavigate,
} from '#/migration/navigation'

/**
 * `/admin` - the AdminCP sign-in screen.
 *
 * **A page, not a layout.** There is no `admin/` directory beside this file and
 * there must not be one. Two things depend on that:
 *
 * 1. `/admin` is a sign-in form, and `_admin` is the admin-session guard. A
 *    nested layout would render the sidebar around the sign-in card and put the
 *    guard in front of the page that exists to create a session. Same shape as
 *    `/login` against `_authenticated`, for the same reason.
 * 2. `isTanStackOwnedPath` requires the deepest match to consume the *whole*
 *    path. As a leaf, `/admin` matches `/admin` and nothing else, so every URL
 *    below it is answered by whichever route actually declares it -
 *    `/admin/content/blog/posts` by the Content Engine's splat under `_admin`,
 *    `/admin/core/users` by its own file, and an unmigrated one by nothing at
 *    all, which is what keeps `MigrationLink` sending it to the Next.js app.
 *    Making this a nested layout is one careless index route away from claiming
 *    the whole subtree and turning every unmigrated screen into a not-found.
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
   * The destination goes through the same rule `MigrationLink` applies, because
   * during the migration most of `/admin/*` is still the Next.js app's:
   *
   *     owned      redirect({ to, search, hash })     client-side, in-app
   *     not owned  redirect({ href, reloadDocument }) full document, legacy app
   *
   * `to` rather than `href` on the owned branch - a redirect carrying `href` is
   * used verbatim by `Router.resolveRedirect` and never reaches `buildLocation`.
   * That matters less here than on `/login` (an admin URL carries no prefix to
   * lose) but the two guards should not differ in shape for a reason that is not
   * written down.
   */
  beforeLoad: async ({ context, search }) => {
    const access = await prefetchAdminAccess(context.queryClient)
    if (!access || !canEnterAdmin(access)) return

    const href = sanitizeAdminReturnTo(search.returnTo)

    // TanStack Router's own control-flow signal - see the note in
    // `routes/_main/_authenticated.tsx`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(
      migrationNavigateOptions(
        resolveMigrationDestination({
          href,
          isOwned: context.ownsPath(href),
          locale: context.locale,
        }),
      ),
    )
  },
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadAdminSignInRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: AdminSignInRoute,
})

function AdminSignInRoute() {
  return (
    <AdminSignInRouteContent
      navigate={useMigrationNavigate()}
      returnTo={Route.useSearch().returnTo}
    />
  )
}
