import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { SessionApi } from "./session-api";
import type { AuthState } from "./state";

import { authStateFromSession, SESSION_QUERY_KEY } from "./state";
import { authTransport } from "./transport";

/**
 * The session, owned by the QueryClient the application already owns.
 *
 * There is no new client and no provider here, and that is the design: the host
 * puts one `QueryClient` in its router context, created once per server request
 * and once in the browser (`apps/web/src/router.tsx`). That lifetime is exactly what a
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
 * Sign-in and sign-out do not wait this out. Sign-out replaces the value
 * outright ({@link setSessionData}); the rest mark the entry invalidated, which
 * {@link ensureAuthState}'s read treats as stale whatever the clock says. So
 * this window governs only the passage of time, never a mutation this app
 * performed.
 */
const SESSION_STALE_TIME = 30_000;

/**
 * The visitor's session, as VitNode's one query definition.
 *
 * Every caller goes through this - a `beforeLoad` guard, a loader warming the
 * cache, a component reading it back - so all of them share one cache entry and
 * one fetch. Two definitions of the same read would be two entries, and the one
 * a guard filled would not be the one the header renders from.
 *
 * `readSession` is the application's `createServerFn` - the one primitive this
 * package may not declare, which is why it arrives through `./transport` - so
 * the fetch happens on the server both times: directly during SSR, and over
 * same-origin RPC on client navigation, which is what carries the visitor's
 * cookies to a place that may read them. The browser never talks to the session
 * endpoint itself.
 *
 * ## It asks once
 *
 * `retry: false`, which is a deliberate departure from Query's default of three
 * attempts with backoff. This read is a route guard, not background content: it
 * runs inside `beforeLoad`, and a navigation is blocked for as long as it takes.
 *
 * Retrying makes every failure worse in the same way. A `429` from the rate
 * limiter is answered by sending the same request two more times, which is the
 * thing the limiter is asking the app to stop doing; a `500` turns one round
 * trip into three before the route can show anything, so a navigation appears to
 * hang rather than to fail. Neither retry can succeed at anything the first one
 * could not - the session is whatever the cookie says, and asking again does not
 * change it.
 *
 * So one attempt, and a failure surfaces immediately as a query error, which the
 * route's error path already handles. The visitor retries by reloading or
 * navigating again, which is a decision they can make and a rate limiter can see
 * coming. This is emphatically *not* a return to reading a failure as
 * `user: null` - see `readSessionOnApi` in `./server`, which rejects rather
 * than inventing a guest.
 */
export const sessionQueryOptions = () =>
  queryOptions({
    queryFn: async () => await authTransport().readSession(),
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    staleTime: SESSION_STALE_TIME,
  });

/**
 * The auth state, reading the session first if what is cached cannot be trusted.
 *
 * What a route's `beforeLoad` calls, and the only function it needs. It is safe
 * to call on a preload: this is a read that fills a cache entry - it cannot
 * create or end a session, and the API call behind it is a `GET` whose
 * `Set-Cookie` this layer deliberately does not save (`saveApiCookies` is for
 * responses to sign-in, not to a session read). Two routes guarding themselves
 * during one navigation share the single in-flight request, because
 * `query.fetch()` returns the promise already in flight rather than starting a
 * second one.
 *
 * Returns the decision material and leaves the decision to the caller. No
 * `redirect()` here on purpose: where a blocked visitor is sent is a property of
 * the route that blocked them, so it belongs in the route tree - which is also
 * the only layer that should be importing the router.
 *
 * ## Why `fetchQuery` and not `ensureQueryData`
 *
 * They differ in exactly one case, and it is the case a guard exists for.
 * `ensureQueryData` returns whatever is cached the moment anything is cached:
 *
 *     if (cachedData !== undefined) return Promise.resolve(cachedData)
 *
 * - no staleness check, and **no check of whether the entry was invalidated**.
 * So a guard reading through it could not see a sign-in that had just happened.
 * {@link invalidateSession} marks the entry, `ensureQueryData` ignores the mark,
 * and the guard decides on the previous visitor.
 *
 * That was survivable only by accident. `invalidateQueries` ends in
 * `refetchQueries({ type: 'active' })`, so the refetch that actually kept this
 * correct was the one performed for the session observer `RealtimeListeners`
 * mounts at the root - a component mounted for the WebSocket's sake, whose
 * removal or relocation into the shell would have silently turned every
 * post-sign-in navigation into a bounce back to the login page. A guard must not
 * depend on an unrelated component being mounted.
 *
 * `fetchQuery` asks the query itself, through `isStaleByTime`:
 *
 *     invalidated                  -> read again      (a sign-in just happened)
 *     older than SESSION_STALE_TIME -> read again      (the window has passed)
 *     otherwise                     -> the cached value, no round trip
 *
 * which is precisely what {@link SESSION_STALE_TIME} is documented to buy, and
 * the preload behaviour that motivates it is unchanged: hovering a guarded link
 * inside the window still costs nothing.
 *
 * ## It resolves only when the session is actually known
 *
 * An {@link AuthState} is returned when - and only when - the session query
 * succeeded. `readSession` rejects if the session could not be read at all (a
 * 429, a 500, an unreachable API), so `fetchQuery` rejects and so does this.
 * That is deliberate and it is the whole point of the contract:
 * `authStateFromSession` describes two *known* states, and there is no third
 * value for "we could not find out".
 *
 * `fetchQuery` rather than `prefetchQuery` matters here too - the latter is the
 * same read with `.catch(noop)` on the end, which would turn an outage into a
 * silently stale answer. See {@link prefetchSession}, which wants exactly that
 * and is the only caller allowed to.
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
  authStateFromSession(await queryClient.fetchQuery(sessionQueryOptions()));

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
  queryClient.setQueryData(sessionQueryOptions().queryKey, session);
};

/**
 * Mark the cached session stale, so the next reader fetches the truth.
 *
 * The other half of the pair above, for the cases where the client cannot know
 * the new session: a sign-in, a verified sign-up, an SSO callback, a sign-out
 * whose response only says it worked. Invalidating rather than clearing keeps
 * the current answer on screen while the fresh one is fetched, instead of
 * blanking every component that reads the session.
 *
 * ## What "the next reader" means, exactly
 *
 * Two different things, and both have to hold or a sign-in navigates as the
 * previous visitor:
 *
 * - **A guard.** {@link ensureAuthState} goes through `fetchQuery`, which asks
 *   `isStaleByTime` - and an invalidated entry is stale by definition. So the
 *   mark is what the guard acts on, with no observer involved. That is the half
 *   this used to get wrong; see the long note there.
 * - **A component.** `invalidateQueries` also ends in
 *   `refetchQueries({ type: 'active' })`, so anything currently observing the
 *   entry - the header, the WebSocket identity sync - refetches. Awaiting this
 *   call is therefore how a caller knows the header has caught up too, which is
 *   why every auth action awaits it before it navigates.
 *
 * The first is a correctness property and the second is a rendering one. They
 * are easy to conflate because until Stage 9 only the second was actually
 * running.
 */
export const invalidateSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

/**
 * Fill the session entry without letting a failed read take the page down.
 *
 * What a layout loader calls so the header renders the visitor on the *first*
 * paint. `ensureAuthState` is the wrong tool for that job in one specific way:
 * it rejects when the session cannot be read, which is exactly right for a guard
 * - an outage must not sign anybody out - and exactly wrong for a shell, where
 * the same rejection would replace every page on the site with an error screen
 * because the header could not name the visitor.
 *
 * `prefetchQuery` is the difference: same query definition, same key, same single
 * in-flight request, and a failure is recorded in the cache entry instead of
 * thrown. So the shell renders, the SSR pass dehydrates whatever was learned, and
 * the header reads it back through `useQuery` - `data` when the read worked,
 * `isError` when it did not, and `userHeaderState` decides what that looks like.
 *
 * Deliberately not a second query. Anything that guards a route still goes
 * through {@link ensureAuthState}, and both reach the one entry this module owns
 * - so a page under `_authenticated` and the header above it cannot disagree
 * about who is signed in.
 */
export const prefetchSession = async (
  queryClient: QueryClient,
): Promise<void> => {
  await queryClient.prefetchQuery(sessionQueryOptions());
};
