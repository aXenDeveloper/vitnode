import type { AbstractIntlMessages } from 'use-intl'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { SignUpFormContent } from '@vitnode/core/views/auth/sign-up/form/sign-up-form-content'
import { SignUpContent } from '@vitnode/core/views/auth/sign-up/sign-up-content'
import { SSOButtonsContent } from '@vitnode/core/views/auth/sso/buttons/sso-buttons-content'
import { createTranslator } from 'use-intl'

import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { startSsoAction, useSignUpAction } from '#/lib/auth/actions'
import { ensureAuthState } from '#/lib/auth/query'
import {
  parseInternalDestination,
  postAuthDestination,
} from '#/lib/auth/redirects'
import { canAccessGuestRoute } from '#/lib/auth/shared'
import { intlQueryOptions } from '#/lib/i18n/query'
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from '#/lib/middleware-config'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * The registration page, rendered outside Next.js.
 *
 * One route file serving `/register` and `/pl/register`: Stage 3's rewrite
 * strips the prefix before matching and writes it back into every link the
 * router builds, so nothing here mentions a language and there is no
 * `/pl/register.tsx` to keep in step. The Next.js route at
 * `packages/vitnode/src/routes/main/register/page.tsx` is still live and
 * unchanged - this is a parallel slice until the cutover.
 *
 * ## Where it sits
 *
 * A direct child of the root, alongside `/login` and the SSO callback, and
 * deliberately **not** under `_main`. That is Stage 8's decision rather than this
 * stage's: the auth screens are full-height blank pages that own their own
 * measure and their own `<main>`, and mounting the site header above a signup
 * card would be a product change nobody asked for. `src/tests/main-shell.test.ts`
 * pins that this file renders exactly one `<main>`, because with no shell above
 * it a page without one is a document with no main landmark at all.
 *
 * ## What is shared
 *
 * Everything visible. `SignUpContent`, `SignUpFormContent` and
 * `SSOButtonsContent` are the same modules the Next.js page renders, handed the
 * three things a shared component cannot resolve for itself: a `Link`, a way to
 * register, and a way to start an SSO flow. The email-confirmation screen comes
 * with `SignUpContent` - it mounts `WrapperSignUp` itself - so there is nothing
 * to wire here for the unverified branch.
 */

/**
 * What this page renders strings from.
 *
 * `core.global` is the heading's and the error toasts', `core.auth.sign_up` is
 * the form's, `core.auth.sso` is the provider row's - the same three the Next.js
 * view declares. One list, read by both the loader that fetches them and the
 * provider that mounts them, because they have to be the same set or the
 * provider suspends on a key nobody warmed.
 */
const REGISTER_NAMESPACES = [
  'core.global',
  'core.auth.sign_up',
  'core.auth.sso',
] as const

/**
 * The page's own title, translated once, in the request's language.
 *
 * `core.global.register` - the same key the Next.js route's `generateMetadata`
 * reads. The cast is what makes `createTranslator` usable here at all; see the
 * long note on `translateTitle` in `routes/login.tsx`, which has the identical
 * shape for the identical reason.
 */
const translateTitle = (locale: string, messages: AbstractIntlMessages) =>
  createTranslator({
    locale,
    messages: messages as { core: { global: { register: string } } },
    namespace: 'core.global',
  })('register')

export const Route = createFileRoute('/register')({
  /**
   * Guest-only, decided before anything renders - the same rule `/login`
   * applies, through the same predicate.
   *
   * There is no second guard implementation here and there must not be:
   * `canAccessGuestRoute` is the inverse of the rule `_authenticated` enforces,
   * so "signed in" cannot come to mean two different things on two pages.
   *
   * ## Where a signed-in visitor goes
   *
   * The front page, and only the front page. This route takes **no `returnTo`**,
   * because nothing sends one: the login card's "create an account" link is a
   * bare `/register` in both frameworks, and inventing a parameter here would be
   * a behaviour the Next.js page does not have. `postAuthDestination(undefined)`
   * is the same helper `/login` and the SSO callback use to say "wherever a
   * finished sign-in lands with nothing asked for", so the answer stays in one
   * place.
   *
   * `parseInternalDestination` rather than `href`, so the redirect goes through
   * `buildLocation` and the locale rewrite writes the prefix back - a Polish
   * visitor is sent to `/pl`, not to `/`.
   *
   * ## A failed session read is not a guest
   *
   * `ensureAuthState` rejects when the session could not be read at all, and that
   * rejection propagates: only a session the API actually answered can send
   * anybody anywhere. It reads the one canonical entry, so a guard that runs on
   * hover (`defaultPreload: 'intent'`) shares its request with the one the
   * navigation itself makes.
   */
  beforeLoad: async ({ context }) => {
    const auth = await ensureAuthState(context.queryClient)

    if (!canAccessGuestRoute(auth)) {
      // TanStack Router's own control-flow signal - see the note in
      // `routes/_main/_authenticated.tsx`.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(parseInternalDestination(postAuthDestination(undefined)))
    }
  },
  /**
   * The two reads this page needs, in parallel and before it renders.
   *
   * Neither is repeated by the component: the messages are read back by
   * `RouteMessages` through the identical `intlQueryOptions`, and the deployment
   * configuration by `useSuspenseQuery` through the identical
   * `middlewareConfigQueryOptions` - the same entry `/login` warms, so arriving
   * from the login card costs nothing.
   *
   * The session is *not* fetched. `beforeLoad` has already put it in the cache
   * entry every guard reads.
   */
  loader: async ({ context }) => {
    const [intl] = await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: REGISTER_NAMESPACES,
        }),
      ),
      context.queryClient.ensureQueryData(middlewareConfigQueryOptions()),
    ])

    return { title: translateTitle(context.locale, intl.messages) }
  },
  /**
   * The tab title, in the language the request resolved to.
   *
   * **`head` must be written after `loader`**: `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order.
   *
   * `formatPageTitle` applies the same `"<page> - <site>"` rule Next.js applies
   * through `title.template`, so both frameworks produce the same title.
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
  component: RegisterRoute,
})

function RegisterRoute() {
  /**
   * The deployment configuration, and a deliberate decision not to branch on
   * whether it was actually read.
   *
   * `config.isKnown` is available here - the same certainty flag password
   * recovery acts on - and registration keeps its degraded rendering anyway: on
   * an outage the card still shows the fields, minus the captcha widget and the
   * provider row. That is a real cost on a captcha-configured deployment, where
   * the submit then carries an empty token and the API answers `400`, which the
   * form raises as the internal-error toast. Degraded, but never wrong: nothing
   * is created and nothing is claimed to have been.
   *
   * It stays that way because the alternative is worse for the same visitor. A
   * hard error would take registration down for every deployment - captcha or
   * not - because one optional read failed, and most VitNode installs configure
   * no captcha at all, so their signup would work perfectly if only it rendered.
   * Password recovery is different in kind rather than in degree: there the
   * fallback does not degrade a screen, it *asserts a fact* - "this deployment
   * sends no email" - and turns that into a 404.
   */
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions())

  /**
   * Registering, and what happens on the two kinds of success.
   *
   * The action is Agent A's, and it owns the ordering that matters: on a
   * deployment with no email adapter the API marks the account verified and
   * mints a session on the same response, so the cookie is copied onto this
   * response, the canonical session entry is invalidated, and only then does the
   * router move - a navigation that ran first would arrive at a guard still
   * holding the anonymous session.
   *
   * On a deployment *with* an email adapter the account is unverified and no
   * session exists, so the action navigates nowhere and answers
   * `{ emailConfirmation }`; the shared form hands that to `WrapperSignUp` and
   * the card is replaced by the "check your email" screen. Nothing here pretends
   * the visitor is signed in.
   *
   * The destination is a thunk because `useSignInAction` takes one - there is no
   * `returnTo` on this route to read late, so it is a constant, and it is the
   * same `postAuthDestination(undefined)` the guard above sends a signed-in
   * visitor to. Routed through `useMigrationNavigate` inside the action, so a
   * front page this app did not own would still be reached.
   */
  const signUp = useSignUpAction(() => postAuthDestination(undefined))

  return (
    <RouteMessages namespaces={REGISTER_NAMESPACES}>
      <main>
        <SignUpContent
          form={
            <SignUpFormContent
              captcha={config.captcha}
              isEmail={config.isEmail}
              LinkComponent={MigrationLink}
              onSignUp={signUp}
            />
          }
          LinkComponent={MigrationLink}
          sso={
            <SSOButtonsContent
              onSelectProvider={startSsoAction}
              providers={ssoProvidersOf(config)}
            />
          }
        />
      </main>
    </RouteMessages>
  )
}
