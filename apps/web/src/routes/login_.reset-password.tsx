import type { AbstractIntlMessages } from 'use-intl'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { ChangePasswordFormContent } from '@vitnode/core/views/auth/password-reset/change-password-form/change-password-form-content'
import { PasswordResetFormContent } from '@vitnode/core/views/auth/password-reset/form/password-reset-form-content'
import { PasswordResetContent } from '@vitnode/core/views/auth/password-reset/password-reset-content'
import { ErrorContent } from '@vitnode/core/views/error/error-content'
import { createTranslator, useTranslations } from 'use-intl'

import { ErrorActions } from '#/components/error-actions'
import { RouteMessages } from '#/components/route-messages'
import {
  changePasswordFromResetAction,
  requestPasswordResetAction,
} from '#/lib/auth/actions'
import {
  hasPasswordRecovery,
  normalizePasswordResetSearch,
  passwordResetMode,
  passwordResetNamespaces,
} from '#/lib/auth/password-reset-route'
import { LOGIN_PATH, parseInternalDestination } from '#/lib/auth/redirects'
import { intlQueryOptions } from '#/lib/i18n/query'
import { middlewareConfigQueryOptions } from '#/lib/middleware-config'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * Password recovery, rendered outside Next.js - both halves of it.
 *
 * One route file serving `/login/reset-password` and
 * `/pl/login/reset-password`, and within each, two screens chosen from the
 * query:
 *
 *     /login/reset-password                       ask for a link
 *     /login/reset-password?token=..&userId=..    choose a new password
 *
 * which is what the Next.js `PasswordResetView` does with `if (token && userId)`.
 * That route is still live and unchanged; this is a parallel slice until the
 * cutover.
 *
 * ## Why it is a sibling of `/login` rather than a child
 *
 * The file is `login_.reset-password.tsx` - the trailing underscore opts out of
 * nesting - and the reason is the same one that keeps the SSO callback out from
 * under `/login`, only sharper here.
 *
 * **`/login`'s guard must not run on this page.** `/login` is guest-only; this
 * is not, and must not be. A recovery link is followed out of an email, on
 * whatever device happens to be to hand, and a visitor who is already signed in
 * somewhere else has every right to finish setting a new password - the Next.js
 * view has never checked a session, and neither does this. Nested under `/login`
 * the guest guard would redirect them away mid-flow, burning a one-shot token.
 *
 * The second reason still holds too: `/login` must stay an exact match so
 * `isTanStackOwnedPath` decides ownership at each leaf rather than by prefix.
 * Two leaves, no shared parent - `src/tests/auth-routes.test.ts` pins it.
 *
 * ## What is shared
 *
 * Everything visible. `PasswordResetContent`, `PasswordResetFormContent` and
 * `ChangePasswordFormContent` are the same modules the Next.js view renders,
 * handed the three things a shared component cannot resolve for itself: the
 * captcha configuration, the two mutations, and where to go once the password
 * has changed.
 */

/**
 * Where the visitor goes once the password has changed.
 *
 * The login page, replacing the current entry rather than pushing one - which is
 * what the Next.js form does (`replace("/login")`) and worth keeping for a
 * reason beyond parity: the URL being left behind carries a recovery token, and
 * a push would leave it one Back press away.
 *
 * The API mints **no session** on a password change, so this really is the next
 * step rather than a redundant hop: the visitor is still signed out.
 *
 * `parseInternalDestination` rather than a bare `to`, so the navigation goes
 * through `buildLocation` and the rewrite writes the locale prefix back - a
 * Polish visitor lands on `/pl/login`.
 */
const CHANGED_PASSWORD_DESTINATION = {
  ...parseInternalDestination(LOGIN_PATH),
  replace: true,
}

/**
 * The page's own title, translated once, in the request's language.
 *
 * `core.auth.reset_password.title` in **both** modes, which is what the Next.js
 * route's `generateMetadata` produces - it is page-level there and cannot vary
 * by mode. That is why `core.auth.reset_password` is in the base namespace set;
 * see `passwordResetNamespaces`.
 *
 * The cast is what makes `createTranslator` usable here; see the note on
 * `translateTitle` in `routes/login.tsx`.
 */
const translateTitle = (locale: string, messages: AbstractIntlMessages) =>
  createTranslator({
    locale,
    messages: messages as {
      core: { auth: { reset_password: { title: string } } }
    },
    namespace: 'core.auth.reset_password',
  })('title')

export const Route = createFileRoute('/login_/reset-password')({
  validateSearch: normalizePasswordResetSearch,
  /**
   * Password recovery only exists on a deployment that can send email.
   *
   * The API mails the reset link through the configured email adapter, so with
   * no adapter the form's submit could never arrive - which is why the Next.js
   * view answers `notFound()` rather than rendering it. Preserved exactly, in
   * this framework's own vocabulary: `notFound()` from TanStack Router rather
   * than `next/navigation`'s.
   *
   * ## The status is decided before anything renders
   *
   * That is the whole reason this sits in `beforeLoad`, and it is the same
   * argument the Next.js route makes for its `instant = false`: the response
   * status depends on a read only the API can answer, and a page that committed
   * a 200 and then discovered it had nothing to show would leave crawlers,
   * caches and monitoring with a successful reset-password page. Thrown here,
   * the router's server pass resolves the not-found boundary before the stream
   * opens and answers **404** (`applyFailure` in `@tanstack/router-core`), so the
   * status is right without this route setting one by hand.
   *
   * `hasPasswordRecovery` also reads `false` when the configuration could not be
   * read at all - see its own note, which owns that trade-off.
   */
  beforeLoad: async ({ context }) => {
    const config = await context.queryClient.ensureQueryData(
      middlewareConfigQueryOptions(),
    )

    // TanStack Router's own control-flow signal, like `redirect()`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!hasPasswordRecovery(config)) throw notFound()
  },
  /**
   * The loader re-runs when the *mode* changes, and only then.
   *
   * Without this it would warm the namespaces for whichever screen the page was
   * first opened with and never again, so following a fresh recovery link from
   * an already-open request form would mount a provider for a set nobody
   * fetched - which suspends the whole response rather than degrading.
   *
   * The mode rather than the raw parameters, because that is what the read
   * actually depends on: a different token is the same screen.
   */
  loaderDeps: ({ search }) => ({ mode: passwordResetMode(search).mode }),
  /**
   * The strings this mode renders, warmed before it renders.
   *
   * `namespaces` is returned rather than recomputed in the component so the set
   * mounted is *literally* the set warmed - the list is part of the query key,
   * and two derivations that drifted would suspend the page.
   *
   * The deployment configuration is not fetched again: `beforeLoad` has already
   * put it in the cache entry the component reads back.
   */
  loader: async ({ context, deps }) => {
    const namespaces = passwordResetNamespaces(deps.mode)
    const intl = await context.queryClient.ensureQueryData(
      intlQueryOptions({ locale: context.locale, namespaces }),
    )

    return { namespaces, title: translateTitle(context.locale, intl.messages) }
  },
  /**
   * The tab title. **`head` must be written after `loader`** - see the note in
   * `routes/register.tsx`.
   */
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: formatPageTitle(
              vitNodeShellConfig.metadata,
              loaderData.title,
            ),
          },
        ]
      : [],
  }),
  /**
   * The 404 for an install with no email adapter.
   *
   * Core's shared error screen, with this framework's navigation in its `actions`
   * slot - the same pair the SSO callback renders, which is why the buttons live
   * in `#/components/error-actions` rather than in either route.
   *
   * `core.global` comes from the root route, so this translates without a
   * `RouteMessages` above it - which it has to, because a `notFoundComponent`
   * renders *instead of* the component that would have mounted one. This app has
   * no global not-found screen yet; when it grows one, this route can drop its
   * own.
   */
  notFoundComponent: PasswordRecoveryUnavailable,
  component: PasswordResetRoute,
})

function PasswordRecoveryUnavailable() {
  const t = useTranslations('core.global')

  return (
    <main>
      <ErrorContent
        actions={<ErrorActions />}
        code={404}
        description={t('errors.404.desc')}
        title={t('errors.404.title')}
      />
    </main>
  )
}

function PasswordResetRoute() {
  const { namespaces } = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions())

  /**
   * Which screen, decided from the same pure function the loader used - so the
   * namespaces mounted below are the ones warmed for this mode.
   *
   * The change-password branch carries the *parsed* link, which is what makes it
   * impossible to render that form without both halves of a well-formed one.
   */
  const mode = passwordResetMode(search)

  return (
    <RouteMessages namespaces={namespaces}>
      <main>
        <PasswordResetContent>
          {mode.mode === 'change' ? (
            <ChangePasswordFormContent
              link={mode.link}
              onChanged={() => {
                void router.navigate(CHANGED_PASSWORD_DESTINATION)
              }}
              onChangePassword={changePasswordFromResetAction}
            />
          ) : (
            /*
              No `onSuccess` and no navigation: an accepted request swaps the
              card for "check your email" and leaves the visitor there, which is
              what the Next.js form does. It says the same thing for an address
              with an account and one without, because the API answers the same
              201 for both - the anti-enumeration behaviour is preserved by there
              being nothing here that could distinguish them.
            */
            <PasswordResetFormContent
              captcha={config.captcha}
              onRequestReset={requestPasswordResetAction}
            />
          )}
        </PasswordResetContent>
      </main>
    </RouteMessages>
  )
}
