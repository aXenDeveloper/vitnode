import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import { cn } from '@vitnode/core/lib/utils'
import { SSOCallbackContent } from '@vitnode/core/views/auth/sso/callback/sso-callback-content'
import { useSSOCallback } from '@vitnode/core/views/auth/sso/callback/use-sso-callback'
import { ArrowLeft, HomeIcon } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { z } from 'zod'

import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { useCompleteSsoAction } from '#/lib/auth/actions'
import { parseSsoCallback } from '#/lib/auth/contract'
import {
  parseInternalDestination,
  postAuthDestination,
} from '#/lib/auth/redirects'
import { intlQueryOptions } from '#/lib/i18n/query'
import {
  middlewareConfigQueryOptions,
  ssoProvidersOf,
} from '#/lib/middleware-config'

/**
 * Where an SSO provider sends the visitor back to.
 *
 * `/login/sso/google` and `/pl/login/sso/google` are one route, and the URL
 * shape is not this app's to choose: the API registers it with every provider as
 * `${NEXT_PUBLIC_WEB_URL}login/sso/<id>` (`api/models/sso.ts`), so whichever app
 * that origin serves has to answer it. This is the TanStack Start half of that,
 * matching the Next.js route at
 * `packages/vitnode/src/routes/main/login/sso/[providerId]/page.tsx` exactly.
 *
 * ## Why it is a sibling of `/login` and not a child
 *
 * The file is `login_.sso.$providerId.tsx` - the trailing underscore opts out of
 * nesting - and that spelling is load bearing twice over.
 *
 * 1. **The guest guard must not run here.** By the time a provider redirects
 *    back, the API has already minted its `--state-sso` cookie and the visitor
 *    may well have been signed in by a parallel tab. Sitting under `/login`'s
 *    guard, a signed-in visitor arriving with a valid `code` would be bounced
 *    away before the exchange ran, abandoning a half-finished OAuth round trip.
 *    An unfinished flow is finished here, whoever is asking.
 * 2. **`/login` must stay an exact match.** A `/login` route with children is a
 *    route that matches `/login/reset-password` too, and `isTanStackOwnedPath`
 *    would then hand that legacy URL to this router as a client-side navigation
 *    to a page it cannot render. Two leaves, no shared parent.
 *
 * The exchange itself is unchanged and stays on the server: the API verifies
 * `state` against the cookie it minted, deletes it, trades the `code` with the
 * provider and mints the session. Nothing here re-implements or re-checks any of
 * that.
 */

const CALLBACK_NAMESPACES = ['core.global', 'core.auth.sso'] as const

/**
 * What a provider may put in the callback URL.
 *
 * Everything optional and nothing constrained, because which half arrives is the
 * provider's decision - `code` and `state` when the visitor approved, `error`
 * when they did not - and a schema that demanded either would turn a legitimate
 * denial into a router error. The values are judged by `parseSsoCallback`, which
 * bounds their length, classifies the error rather than carrying it through, and
 * is where the whole rule lives.
 */
const callbackSearchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  state: z.string().optional(),
})

export const Route = createFileRoute('/login_/sso/$providerId')({
  validateSearch: callbackSearchSchema,
  /**
   * The provider names, and the strings the screens render.
   *
   * The provider list is what turns `google` in the URL into "Google" on the
   * conflict screen. It is the same cache entry the login page warmed, so
   * arriving here from a client-side navigation costs nothing.
   *
   * No session read and no guard: see the note above.
   */
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: CALLBACK_NAMESPACES,
        }),
      ),
      context.queryClient.ensureQueryData(middlewareConfigQueryOptions()),
    ])
  },
  component: SsoCallbackRoute,
})

/**
 * "Go back" and "go home", for the two screens that end in a dead end.
 *
 * The TanStack half of what `ErrorViewActions` renders in Next.js: the same two
 * buttons and the same two strings, with this framework's navigation behind
 * them. `errorActions` is a slot on the shared screen precisely because this is
 * the part that cannot be shared - `router.history.back()` here,
 * `next-intl`'s `useRouter().back()` there.
 *
 * Declared at module scope so it is the same component type on every render.
 */
const CallbackErrorActions = () => {
  const router = useRouter()
  const t = useTranslations('core.global')

  return (
    <>
      <Button
        onClick={() => {
          router.history.back()
        }}
        size="lg"
        variant="ghost"
      >
        <ArrowLeft />
        {t('go_back')}
      </Button>

      <MigrationLink className={cn(buttonVariants({ size: 'lg' }))} href="/">
        <HomeIcon />
        {t('back_home')}
      </MigrationLink>
    </>
  )
}

function SsoCallbackRoute() {
  const { providerId } = Route.useParams()
  const search = Route.useSearch()
  const router = useRouter()
  const { data: config } = useSuspenseQuery(middlewareConfigQueryOptions())

  /**
   * The callback URL, judged before any of it is sent on: the provider id has to
   * be a slug, `code` and `state` have to be present and bounded, and an `error`
   * is classified rather than carried. A malformed callback never reaches the
   * API.
   */
  const parsed = parseSsoCallback({ providerId, query: search })
  const completeSso = useCompleteSsoAction(parsed.ok ? parsed.params : null)

  /**
   * The exchange, run once, by the shared hook both frameworks use.
   *
   * `oauthError` is the raw `error` parameter, which is what the hook's own rule
   * is written against: `access_denied` disables the query outright - there is
   * nothing to exchange when the visitor said no - and anything else lets it run
   * and fail, which is the screen a provider error should produce anyway. The
   * exchange itself refuses to call the API unless `parseSsoCallback` produced
   * parameters, so neither a malformed callback nor a provider error costs a
   * request.
   */
  const state = useSSOCallback({
    code: parsed.ok ? parsed.params.code : '',
    oauthError: search.error,
    onCallback: completeSso,
    // The front page, through the same rule the login form uses. There is no
    // `returnTo` to honour here and there must not be: this URL is built by the
    // provider from what the API registered with it, so anything in its query
    // came back from another origin. Which is also what the Next.js flow does -
    // `replace("/")`.
    onSignedIn: () => {
      void router.navigate(
        parseInternalDestination(postAuthDestination(undefined)),
      )
    },
    providerId,
  })

  return (
    <RouteMessages namespaces={CALLBACK_NAMESPACES}>
      <main>
        <SSOCallbackContent
          errorActions={<CallbackErrorActions />}
          LinkComponent={MigrationLink}
          providerId={providerId}
          providers={ssoProvidersOf(config)}
          state={state}
        />
      </main>
    </RouteMessages>
  )
}
