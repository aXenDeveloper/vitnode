import type { AbstractIntlMessages } from 'use-intl'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { SignInFormContent } from '@vitnode/core/views/auth/sign-in/form/sign-in-form-content'
import { SignInContent } from '@vitnode/core/views/auth/sign-in/sign-in-content'
import { SSOButtonsContent } from '@vitnode/core/views/auth/sso/buttons/sso-buttons-content'
import { createTranslator } from 'use-intl'
import { z } from 'zod'

import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { startSsoAction, useSignInAction } from '#/lib/auth/actions'
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
 * The login page - the first VitNode auth route to render outside Next.js.
 *
 * One route file serving `/login` and `/pl/login`: Stage 3's rewrite strips the
 * prefix before matching and writes it back into every link the router builds,
 * so nothing here mentions a language and there is no `/pl/login.tsx` to keep in
 * step. The Next.js route at `packages/vitnode/src/routes/main/login/page.tsx`
 * is still live and unchanged - this is a parallel slice until the cutover.
 *
 * Everything visible is shared: `SignInContent`, `SignInFormContent` and
 * `SSOButtonsContent` are the same modules the Next.js page renders, handed the
 * three things a shared component cannot resolve for itself - a `Link`, a way to
 * sign in, and a way to start an SSO flow.
 *
 * ## What is deliberately *not* migrated
 *
 * `/register` and `/login/reset-password` stay on Next.js. They are reached
 * through `MigrationLink`, which asks the route tree whether this app owns a
 * destination and falls back to a document load into the legacy app - so
 * nothing here hardcodes a second origin, and the day either route is migrated
 * this file does not change. `src/tests/plugin-routes.test.ts` pins the other
 * half of that: owning `/login` must not make `/login/reset-password` look
 * owned, which is why the SSO callback is a *non-nested* sibling
 * (`login_.sso.$providerId.tsx`) rather than a child.
 */

/**
 * What this page renders strings from.
 *
 * `core.global` is the shell's and the heading's, `core.auth.sign_in` is the
 * card's and the form's, `core.auth.sso` is the provider row's. One list, read
 * by both the loader that fetches them and the provider that mounts them,
 * because they have to be the same set or the provider suspends on a key nobody
 * warmed.
 */
const LOGIN_NAMESPACES = [
  'core.global',
  'core.auth.sign_in',
  'core.auth.sso',
] as const

/**
 * Where a visitor was heading before the guard sent them here.
 *
 * Accepted as any string and judged where it is used, never here: whether a
 * target is somewhere this app may navigate to is `sanitizeReturnTo`'s single
 * answer, and duplicating it in a schema would be a second rule that can
 * disagree with the first. Rejecting it at parse time would also turn a crafted
 * link into a broken login page rather than an ordinary one.
 */
const loginSearchSchema = z.object({
  returnTo: z.string().optional(),
})

/**
 * The page's own title, translated once, in the request's language.
 *
 * The cast is what makes `createTranslator` usable at all here. Its key type is
 * derived from the *inferred* type of `messages`, and `AbstractIntlMessages` is
 * a bare index signature (`{ [id: string]: AbstractIntlMessages | string }`) -
 * so `MessageKeys` cannot tell a leaf from a branch and collapses to `never`,
 * making every key a type error. Naming the one key this route reads is both the
 * smallest fix and a true statement: if `core.global.login` is ever renamed,
 * this stops compiling instead of rendering a raw message key.
 *
 * (`discover.tsx` gets away with `namespace: 'core.search'` uncast by accident -
 * `search` happens to be a member of `String.prototype`, which perturbs the same
 * inference into producing usable keys. Not a pattern to copy.)
 */
const translateTitle = (locale: string, messages: AbstractIntlMessages) =>
  createTranslator({
    locale,
    messages: messages as { core: { global: { login: string } } },
    namespace: 'core.global',
  })('login')

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  /**
   * Guest-only, decided before anything renders.
   *
   * A signed-in visitor never sees the form - not for a frame - because the
   * decision happens in `beforeLoad` rather than in the component. `redirect`
   * with `to`/`search` rather than `href`: a redirect carrying `href` is used
   * verbatim and never reaches `buildLocation`, so it would skip the locale
   * rewrite and drop a Polish visitor on the English page.
   *
   * `ensureAuthState` reads the one canonical session entry, so a guard that
   * runs on hover (`defaultPreload: 'intent'`) shares its request with the one
   * the navigation itself makes, and cannot create or end a session.
   */
  beforeLoad: async ({ context, search }) => {
    const auth = await ensureAuthState(context.queryClient)

    if (!canAccessGuestRoute(auth)) {
      // TanStack Router's own control-flow signal - see the note in
      // `routes/_authenticated.tsx`.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect(
        parseInternalDestination(postAuthDestination(search.returnTo)),
      )
    }
  },
  /**
   * The two reads this page needs, in parallel and before it renders.
   *
   * Neither is repeated by the component: the messages are read back by
   * `RouteMessages` through the identical `intlQueryOptions`, and the
   * configuration by `useSuspenseQuery` through the identical
   * `middlewareConfigQueryOptions`. A mismatch on either would show up as a
   * render that starts empty and fills in a round trip later.
   *
   * The session is *not* fetched here. `beforeLoad` has already put it in the
   * same cache entry every guard reads, and asking again would be a second
   * request for an answer this route already has.
   */
  loader: async ({ context }) => {
    const [intl] = await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: LOGIN_NAMESPACES,
        }),
      ),
      context.queryClient.ensureQueryData(middlewareConfigQueryOptions()),
    ])

    return { title: translateTitle(context.locale, intl.messages) }
  },
  /**
   * The tab title, in the language the request resolved to - the same string the
   * `<h1>` renders, because the loader translated it once.
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
  component: LoginRoute,
})

function LoginRoute() {
  const { returnTo } = Route.useSearch()
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions())
  const signIn = useSignInAction(() => postAuthDestination(returnTo))

  return (
    <RouteMessages namespaces={LOGIN_NAMESPACES}>
      <main>
        <SignInContent
          form={
            <SignInFormContent
              LinkComponent={MigrationLink}
              onSignIn={signIn}
              showResetPassword={config.isEmail}
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
