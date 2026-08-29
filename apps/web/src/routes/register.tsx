import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  canAccessGuestRoute,
  ensureAuthState,
  loadRegisterRoute,
  parseInternalDestination,
  postAuthDestination,
  RegisterRouteContent,
} from '@vitnode/core/tanstack/auth'

import { pageHead } from '#/lib/page-head'
import { MigrationLink } from '#/migration/link'
import { useMigrationNavigate } from '#/migration/navigation'

/**
 * The registration page, rendered outside Next.js.
 *
 * One route file serving `/register` and `/pl/register`. The Next.js route at
 * `packages/vitnode/src/routes/main/register/page.tsx` is still live and
 * unchanged - this is a parallel slice until the cutover.
 *
 * A direct child of the root, alongside `/login` and the SSO callback, and
 * deliberately **not** under `_main`: the auth screens are full-height blank
 * pages that own their own measure and their own `<main>`, and mounting the site
 * header above a signup card would be a product change nobody asked for.
 * `src/tests/main-shell.test.ts` pins that this route renders exactly one
 * `<main>`, because with no shell above it a page without one is a document with
 * no main landmark at all.
 *
 * The card, the form, the provider row and the sign-up action are
 * `@vitnode/core/tanstack/auth` - including the decision to keep rendering when
 * the deployment configuration could not be read, which is stated where it is
 * made.
 */
export const Route = createFileRoute('/register')({
  /**
   * Guest-only, through the same predicate `/login` uses - there is no second
   * guard implementation here and there must not be, so "signed in" cannot come
   * to mean two different things on two pages.
   *
   * A signed-in visitor goes to the front page and only the front page. This
   * route takes **no `returnTo`**, because nothing sends one: the login card's
   * "create an account" link is a bare `/register` in both frameworks, and
   * inventing a parameter here would be a behaviour the Next.js page does not
   * have.
   *
   * `parseInternalDestination` rather than `href`, so the redirect goes through
   * `buildLocation` and the locale rewrite writes the prefix back - a Polish
   * visitor is sent to `/pl`, not to `/`.
   */
  beforeLoad: async ({ context }) => {
    const auth = await ensureAuthState(context.queryClient)
    if (canAccessGuestRoute(auth)) return

    // TanStack Router's own control-flow signal - see the note in
    // `routes/_main/_authenticated.tsx`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(parseInternalDestination(postAuthDestination(undefined)))
  },
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context }) => await loadRegisterRoute(context),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: RegisterRoute,
})

function RegisterRoute() {
  return (
    <RegisterRouteContent
      LinkComponent={MigrationLink}
      navigate={useMigrationNavigate()}
    />
  )
}
