import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  canAccessGuestRoute,
  ensureAuthState,
  loadLoginRoute,
  LoginRouteContent,
  postAuthDestination,
} from '@vitnode/core/tanstack/auth'
import { z } from 'zod'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'
import {
  migrationNavigateOptions,
  resolveMigrationDestination,
  useMigrationNavigate,
} from '#/migration/navigation'

/**
 * The login page - the first VitNode auth route to render outside Next.js.
 *
 * One route file serving `/login` and `/pl/login`: Stage 3's rewrite strips the
 * prefix before matching and writes it back into every link the router builds,
 * so nothing here mentions a language and there is no `/pl/login.tsx` to keep in
 * step. The Next.js route at `packages/vitnode/src/routes/main/login/page.tsx`
 * is still live and unchanged - this is a parallel slice until the cutover.
 *
 * The card, the form, the provider row, the namespaces they translate through
 * and the sign-in action are `@vitnode/core/tanstack/auth`. What is left here is
 * this application's topology, plus the two things only it can answer: how to
 * build a link, and how to navigate, while half of VitNode still runs on
 * Next.js.
 *
 * ## Why the SSO callback and recovery are siblings, not children
 *
 * `src/tests/plugin-routes.test.ts` pins the half that is easy to get wrong:
 * owning `/login` must not make `/login/anything` look owned. That is why both
 * are *non-nested* siblings (`login_.sso.$providerId.tsx`,
 * `login_.reset-password.tsx`) rather than children - and, for recovery, why it
 * must not inherit this route's guest-only guard.
 */

/**
 * Where a visitor was heading before the guard sent them here.
 *
 * Accepted as any string and judged where it is used, never here: whether a
 * target is somewhere this app may navigate to is `sanitizeReturnTo`'s single
 * answer, and duplicating it in a schema would be a second rule that can
 * disagree with the first. Rejecting it at parse time would also turn a crafted
 * link into a broken login page rather than an ordinary one.
 */
const loginSearchSchema = z.object({ returnTo: z.string().optional() })

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  /**
   * Guest-only, decided before anything renders - so a signed-in visitor never
   * sees the form, not for a frame.
   *
   * `?returnTo=` names wherever they were heading, and during the migration most
   * of those places are still the Next.js app's. So the destination goes through
   * the same rule `MigrationLink` applies, and produces one of two redirects:
   *
   *     owned      redirect({ to, search, hash })     client-side, in-app
   *     not owned  redirect({ href, reloadDocument }) full document, legacy app
   *
   * Expressed as redirect *options* rather than as a navigation, because both
   * work in both environments: on the server the router turns either into an
   * HTTP redirect and in the browser into a client navigation or a document
   * load. Nothing here touches `window`, which a `beforeLoad` running during SSR
   * does not have.
   *
   * **`to` rather than `href` for the owned branch.** A redirect carrying `href`
   * is used verbatim by `Router.resolveRedirect` - it never reaches
   * `buildLocation`, so it would skip the locale rewrite and drop a Polish
   * visitor on the English page.
   *
   * `ensureAuthState` rejects when the session could not be read at all, and
   * that rejection propagates: only a session the API actually answered can send
   * anybody anywhere.
   */
  beforeLoad: async ({ context, search }) => {
    const auth = await ensureAuthState(context.queryClient)
    if (canAccessGuestRoute(auth)) return

    const href = postAuthDestination(search.returnTo)

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
  loader: async ({ context }) => await loadLoginRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <LoginRouteContent
      LinkComponent={MigrationLink}
      navigate={useMigrationNavigate()}
      returnTo={Route.useSearch().returnTo}
    />
  )
}
