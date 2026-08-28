import type { QueryClient } from '@tanstack/react-query'

import { queryOptions } from '@tanstack/react-query'

import type { SessionApi } from '#/lib/session'

import { getSession } from '#/lib/session'

import type { AuthState } from './shared'

import { authStateFromSession, SESSION_QUERY_KEY } from './shared'

/**
 * The session, owned by the QueryClient the router already owns.
 *
 * There is no new client and no provider here, and that is the design: Stage 2
 * put one `QueryClient` in the router context, created once per server request
 * and once in the browser (`src/router.tsx`). That lifetime is exactly what a
 * session needs - per request on the server, so one visitor's session can never
 * be rendered into another's page, and long-lived on the client, so navigating
 * does not re-ask. A module-level `let session` would get the first half
 * catastrophically wrong.
 *
 * Which also means the SSR dehydration carries the visitor's own session into
 * the visitor's own HTML. Correct, and worth stating: that document is
 * personalised and must not be served from a shared cache.
 */

/**
 * How long the router may trust a cached session before asking again.
 *
 * Not zero, because of preloading. The router runs with
 * `defaultPreload: 'intent'` and `defaultPreloadStaleTime: 0`, so hovering a
 * link runs that route's `beforeLoad`; with no stale window, every hovered link
 * costs a round trip for an answer that has not changed.
 *
 * Not `Infinity` either. A session can end somewhere this tab will never hear
 * about - the cookie expires, an admin revokes it, the visitor signs out in
 * another tab - and with no expiry the UI would believe in it until a reload.
 * Being wrong for half a minute costs a stale header, or one navigation into a
 * page whose data the API then refuses; it cannot cost private data, because the
 * API is the boundary and it re-reads the cookie every time.
 *
 * Sign-in and sign-out do not wait this out - they replace the value outright.
 */
const SESSION_STALE_TIME = 30_000

/**
 * The visitor's session, as the app's one query definition.
 *
 * Every caller goes through this - a `beforeLoad` guard, a loader warming the
 * cache, a component reading it back - so all of them share one cache entry and
 * one fetch. Two definitions of the same read would be two entries, and the one
 * a guard filled would not be the one the header renders from.
 *
 * `getSession` is a `createServerFn`, so the fetch happens on the server both
 * times: directly during SSR, and over same-origin RPC on client navigation,
 * which is what carries the visitor's cookies to a place that may read them.
 * The browser never talks to the session endpoint itself.
 */
export const sessionQueryOptions = () =>
  queryOptions({
    queryFn: async () => await getSession(),
    queryKey: SESSION_QUERY_KEY,
    staleTime: SESSION_STALE_TIME,
  })

/**
 * The auth state, fetching the session first if this client has not read it yet.
 *
 * What a route's `beforeLoad` calls, and the only function it needs. It is safe
 * to call on a preload: `ensureQueryData` is a read that fills a cache entry -
 * it cannot create or end a session, and the API call behind it is a `GET` whose
 * `Set-Cookie` this app deliberately does not save (`saveApiCookies` is for
 * responses to sign-in, not to a session read). Two routes guarding themselves
 * during one navigation share the single in-flight request.
 *
 * Returns the decision material and leaves the decision to the caller. No
 * `redirect()` here on purpose: where a blocked visitor is sent is a property of
 * the route that blocked them, so it belongs in the route tree - which is also
 * the only layer that should be importing the router.
 *
 * ## It resolves only when the session is actually known
 *
 * An {@link AuthState} is returned when - and only when - the session query
 * succeeded. `getSession` rejects if the session could not be read at all (a
 * 429, a 500, an unreachable API), so `ensureQueryData` rejects and so does
 * this. That is deliberate and it is the whole point of the contract:
 * `authStateFromSession` describes two *known* states, and there is no third
 * value for "we could not find out".
 *
 * A caller must therefore not treat a rejection as "signed out". Only
 * `auth.isAuthenticated === false` means that. A rejection propagating out of a
 * `beforeLoad` is an ordinary route error and takes the router's normal error
 * path, which is what leaves a signed-in visitor on the page they asked for
 * instead of bouncing them to the login form during an outage.
 */
export const ensureAuthState = async (
  queryClient: QueryClient,
): Promise<AuthState> =>
  authStateFromSession(await queryClient.ensureQueryData(sessionQueryOptions()))

/**
 * Replace the cached session with one the server just answered with.
 *
 * For sign-in and sign-out, which learn the new session as part of their own
 * response: writing it here means the next render is already right, with no
 * round trip in between and no frame showing the previous visitor.
 *
 * The key comes from `sessionQueryOptions()` rather than being spelled out, so
 * TanStack Query checks the value against what the query is declared to return.
 */
export const setSessionData = (
  queryClient: QueryClient,
  session: SessionApi,
): void => {
  queryClient.setQueryData(sessionQueryOptions().queryKey, session)
}

/**
 * Mark the cached session stale and let the next reader fetch the truth.
 *
 * The other half of the pair above, for the cases where the client cannot know
 * the new session: an SSO callback, a profile change, a sign-out whose response
 * only says it worked. Invalidating rather than clearing keeps the current
 * answer on screen while the fresh one is fetched, instead of blanking every
 * component that reads the session.
 */
export const invalidateSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
