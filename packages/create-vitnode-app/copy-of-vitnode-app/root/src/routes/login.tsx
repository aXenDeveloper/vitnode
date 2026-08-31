import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  canAccessGuestRoute,
  ensureAuthState,
  loadLoginRoute,
  LoginRouteContent,
  normalizeLoginSearch,
  postAuthDestination,
} from '@vitnode/core/tanstack/auth'
import { RouterLink } from '@vitnode/core/tanstack/layout'

import { internalDestination, useAppNavigate } from '#/lib/navigation'
import { pageHead } from '#/lib/page-head'

/**
 * The login page.
 *
 * One route file serving `/login` and `/pl/login`: the rewrite strips the prefix
 * before matching and writes it back into every link the router builds, so
 * nothing here mentions a language and there is no `/pl/login.tsx` to keep in
 * step.
 *
 * The card, the form, the provider row, the namespaces they translate through
 * and the sign-in action are `@vitnode/core/tanstack/auth`. What is left here is
 * this application's topology, plus how a finished sign-in moves.
 *
 * ## Why the SSO callback and recovery are siblings, not children
 *
 * They are *non-nested* siblings (`login_.sso.$providerId.tsx`,
 * `login_.reset-password.tsx`) rather than children, so `/login`'s guest-only
 * guard does not sit in front of a password reset - which somebody who cannot
 * sign in is by definition performing while signed out. `src/tests/auth-routes.test.ts`
 * pins the shape.
 */

export const Route = createFileRoute('/login')({
  /**
   * Where a visitor was heading before the guard sent them here.
   *
   * `normalizeLoginSearch` is the package's, like every other route's search
   * contract: what a stranger may put in `?returnTo=` is the same question on
   * every VitNode install, and the answer is not this application's topology.
   * It keeps whatever arrived and judges nothing - `sanitizeReturnTo` is the
   * single answer to whether a target is somewhere this app may navigate to, and
   * it is applied where the value is *used*.
   */
  validateSearch: normalizeLoginSearch,
  /**
   * Guest-only, decided before anything renders - so a signed-in visitor never
   * sees the form, not for a frame.
   *
   * `?returnTo=` names wherever they were heading, and it is theirs to supply -
   * so it goes through the two questions in that order. `postAuthDestination`
   * answers whether this app may send a browser there at all (`sanitizeReturnTo`
   * rejects every origin and scheme spelling, and the loop guard rejects the
   * login page itself), and `internalDestination` answers what the router wants
   * to be handed.
   *
   * Expressed as redirect *options* rather than as a navigation, because the
   * same shape works in both environments: on the server the router turns it
   * into an HTTP redirect and in the browser into a client navigation. Nothing
   * here touches `window`, which a `beforeLoad` running during SSR does not
   * have.
   *
   * **`to` rather than `href`.** A redirect carrying `href` is used verbatim by
   * `Router.resolveRedirect` - it never reaches `buildLocation`, so it would
   * skip the locale rewrite and drop a Polish visitor on the English page.
   * `internalDestination` returns the split shape for exactly that reason, and
   * strips the prefix off a `returnTo` that arrived carrying one.
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
    throw redirect(internalDestination(href))
  },
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadLoginRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <LoginRouteContent
      LinkComponent={RouterLink}
      navigate={useAppNavigate()}
      returnTo={Route.useSearch().returnTo}
    />
  )
}
