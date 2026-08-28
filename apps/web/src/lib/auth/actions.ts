import type { SignInSubmit } from '@vitnode/core/views/auth/sign-in/form/sign-in-form-content'
import type { SSOSelectProvider } from '@vitnode/core/views/auth/sso/buttons/sso-buttons-content'
import type { SSOCallbackResult } from '@vitnode/core/views/auth/sso/callback/sso-callback-result'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import type { SsoCallbackInput } from '#/lib/auth/contract'

import { completeSso, signIn, signOut, startSso } from '#/lib/auth/mutations'
import {
  invalidateSession,
  sessionQueryOptions,
  setSessionData,
} from '#/lib/auth/query'
import {
  anonymousSession,
  signInFormResult,
  ssoCallbackResult,
  ssoStartFeedback,
} from '#/lib/auth/screens'
import { useMigrationNavigate } from '#/lib/migration-navigation'

/**
 * The four things a visitor can do to their own session, as this app's only
 * auth actions.
 *
 *     component  ->  action  ->  server function  ->  Hono  ->  Set-Cookie
 *                       |
 *                       +->  canonical session cache  ->  route guards
 *
 * Every one of them ends the same way: the cached session is brought back in
 * step with the cookie the browser now holds, *before* anything navigates. That
 * ordering is the whole reason these are hooks and not four inline callbacks -
 * a navigation that runs first arrives at a guard reading the previous
 * visitor's state, which is either a bounce back to the login page or a flash
 * of a page the visitor is no longer entitled to.
 *
 * There is no second auth store. `#/lib/auth/query` owns the one cache entry
 * every guard and component reads, and these write to exactly that entry.
 *
 * None of this is a security boundary. Hono authorizes every private read from
 * the session cookie, in its own handlers, and keeps doing so whatever this
 * cache says.
 */

/**
 * Signing in, in the shape `SignInFormContent` submits.
 *
 * `undefined` on success, which is the shared form's way of saying "the caller
 * is navigating" - and it is, on the line above. On failure the form gets the
 * legacy vocabulary back and renders the alert or the toast itself.
 *
 * The session is invalidated rather than written, because the sign-in reply says
 * only that it worked - the session body comes from the next read, which the
 * destination's guard performs through the one query definition. Doing it before
 * navigating is what makes that read see the new cookie.
 *
 * The navigation goes through `useMigrationNavigate` rather than
 * `router.navigate`, because `?returnTo=` names somewhere the visitor was
 * heading and most of VitNode has not moved yet. `/discover` is a client-side
 * navigation; `/settings/security?tab=devices` is a full-document load into the
 * Next.js app that still serves it. The route tree decides which - there is no
 * list of migrated auth destinations anywhere.
 */
export const useSignInAction = (destination: () => string): SignInSubmit => {
  const queryClient = useQueryClient()
  const navigate = useMigrationNavigate()

  return async (values) => {
    const result = await signIn({ data: values })

    if (!result.ok) return signInFormResult(result)

    await invalidateSession(queryClient)
    await navigate(destination())

    return undefined
  }
}

/**
 * Starting an SSO sign-in.
 *
 * A plain function rather than a hook: it reads no cached state and moves no
 * router, because success leaves this application entirely.
 *
 * The provider is another origin, so leaving is a full-document navigation
 * rather than a router one - and it has to be, because the round trip comes back
 * to a URL the provider was told about, not to a client-side route.
 *
 * The reply to this call carries the API's short-lived `--state-sso` cookie,
 * which `saveApiCookies` writes onto the browser before this returns. Navigating
 * away any earlier would lose it and the callback would fail its state check.
 */
export const startSsoAction: SSOSelectProvider = async (providerId) => {
  const result = await startSso({ data: { providerId } })

  if (!result.ok) return ssoStartFeedback(result)

  globalThis.location.assign(result.url)

  return undefined
}

/**
 * Finishing an SSO sign-in - the exchange half of `useSSOCallback`.
 *
 * Takes the parameters `parseSsoCallback` validated, or `null` when the callback
 * URL never carried a usable set. `null` answers `unknown` without calling the
 * API at all: a callback with no `code` has nothing to exchange, and sending it
 * anyway would be a request whose only possible outcome is an error.
 */
export const useCompleteSsoAction = (params: null | SsoCallbackInput) => {
  const queryClient = useQueryClient()

  return async (): Promise<SSOCallbackResult> => {
    if (!params) return { failure: 'unknown' }

    const result = await completeSso({ data: params })

    if (result.ok) await invalidateSession(queryClient)

    return ssoCallbackResult(result)
  }
}

/**
 * Signing out.
 *
 * Two writes, in this order, and both are needed:
 *
 * 1. **Write the anonymous session.** The reply carries the cookie deletion but
 *    not a session body, so without this the cache still holds the previous
 *    visitor until a refetch returns - and every guard and component reading it
 *    in between believes them still signed in.
 * 2. **Invalidate.** The written value is this app's inference, not the server's
 *    answer; marking it stale means the next reader confirms it.
 *
 * `router.invalidate()` then re-runs the matched routes' `beforeLoad`, so a
 * visitor sitting on a page behind `_authenticated` is redirected out of it by
 * the guard that owns that rule, rather than by anything here.
 *
 * Exported for the shell migration that will mount the header. Nothing in this
 * app renders a sign-out control yet, and adding one would mean migrating the
 * header, which is a different stage.
 */
export const useSignOutAction = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  return async ({ isAdmin = false }: { isAdmin?: boolean } = {}) => {
    const result = await signOut({ data: { isAdmin } })

    if (!result.ok) return result

    const current = queryClient.getQueryData(sessionQueryOptions().queryKey)
    if (current) setSessionData(queryClient, anonymousSession(current))

    await invalidateSession(queryClient)
    await router.invalidate()

    return result
  }
}
