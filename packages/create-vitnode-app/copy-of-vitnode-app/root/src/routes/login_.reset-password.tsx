import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  loadPasswordResetRoute,
  middlewareConfigQueryOptions,
  normalizePasswordResetSearch,
  passwordRecoveryAvailability,
  PasswordRecoveryNotFound,
  PasswordRecoveryUnknownError,
  passwordResetMode,
  PasswordResetRouteContent,
} from '@vitnode/core/tanstack/auth'
import { ErrorActions } from '@vitnode/core/tanstack/layout'

import { pageHead } from '#/lib/page-head'

/**
 * Password recovery - both halves of it.
 *
 * One route file serving `/login/reset-password` and
 * `/pl/login/reset-password`, and within each, two screens chosen from the
 * query.
 *
 * ## Why it is a sibling of `/login` rather than a child
 *
 * The file is `login_.reset-password.tsx` - the trailing underscore opts out of
 * nesting - and the reason is sharper here than for the SSO callback.
 *
 * **`/login`'s guard must not run on this page.** `/login` is guest-only; this
 * is not, and must not be. A recovery link is followed out of an email, on
 * whatever device happens to be to hand, and a visitor who is already signed in
 * somewhere else has every right to finish setting a new password - the Next.js
 * view has never checked a session, and neither does this. Nested under `/login`
 * the guest guard would redirect them away mid-flow, burning a one-shot token.
 *
 * The second reason still holds too: `/login` must stay an exact match, so a
 * URL beneath it is answered by the route that declares it rather than swallowed
 * by a parent. `src/tests/auth-routes.test.ts` pins it.
 */
export const Route = createFileRoute('/login_/reset-password')({
  validateSearch: normalizePasswordResetSearch,
  /**
   * Password recovery only exists on a deployment that can send email - and "we
   * could not find out" is a third answer, not a fourth spelling of no.
   *
   * The API mails the reset link through the configured email adapter, so with
   * no adapter the form's submit could never arrive, which is why the Next.js
   * view answers `notFound()` rather than rendering it. Preserved exactly, in
   * this framework's own vocabulary.
   *
   * What is *not* preserved is answering the same way when the configuration
   * could not be read. The fallback the config query degrades to says
   * `isEmail: false` - correct for the login form - and reading that as a
   * boolean here turned an API outage into a **404**: this application asserting
   * the page does not exist because it could not reach its own API, to a visitor
   * holding a valid recovery link. `passwordRecoveryAvailability` separates the
   * two, and the outage takes the router's ordinary error path instead.
   *
   * It sits in `beforeLoad` because the response *status* depends on it: the
   * router's server pass resolves the boundary before the stream opens and
   * answers 404 for a genuinely disabled deployment, so the status is right
   * without this route setting one by hand.
   */
  beforeLoad: async ({ context }) => {
    const availability = passwordRecoveryAvailability(
      await context.queryClient.ensureQueryData(middlewareConfigQueryOptions()),
    )

    // Not a 404: the route exists, the API could not say whether the flow does.
    if (availability === 'unknown') throw new PasswordRecoveryUnknownError()

    // TanStack Router's own control-flow signal, like `redirect()`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (availability === 'disabled') throw notFound()
  },
  /**
   * The loader re-runs when the *mode* changes, and only then - a different
   * token is the same screen. Without this it would warm the namespaces for
   * whichever screen the page was first opened with and never again, so
   * following a fresh recovery link from an already-open request form would
   * mount a provider for a set nobody fetched.
   */
  loaderDeps: ({ search }) => ({ mode: passwordResetMode(search).mode }),
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps }) =>
    await loadPasswordResetRoute({ ...context, mode: deps.mode }),
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  notFoundComponent: () => (
    <PasswordRecoveryNotFound actions={<ErrorActions />} />
  ),
  component: PasswordResetRoute,
})

function PasswordResetRoute() {
  return (
    <PasswordResetRouteContent
      namespaces={Route.useLoaderData().namespaces}
      search={Route.useSearch()}
    />
  )
}
