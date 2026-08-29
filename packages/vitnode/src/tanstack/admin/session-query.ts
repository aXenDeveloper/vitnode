import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { AdminAccessState } from "./session-api";

import {
  ADMIN_SESSION_QUERY_KEY,
  AdminSessionUnavailableError,
  isAdminAccess,
} from "./state";
import { adminTransport } from "./transport";

/**
 * The admin session, owned by the QueryClient the application already owns.
 *
 * There is no new client, no provider and no admin store here, and that is the
 * design: the host puts one `QueryClient` in its router context, created once
 * per server request and once in the browser (`apps/web/src/router.tsx`). That
 * lifetime is exactly what an admin session needs - per request on the server,
 * so one administrator's permissions can never be rendered into another's page,
 * and one per browser on the client, so navigating around the AdminCP does not
 * re-ask on every link.
 *
 * Which also means the SSR dehydration carries this administrator's permission
 * set into this administrator's HTML. Correct, and worth stating: that document
 * is personalised and must not be served from a shared cache.
 */

/**
 * How long the router may trust a cached admin session. It may not.
 *
 * `0`, which is a deliberate departure from the 30 seconds the *public* session
 * takes. That window exists to make preloading cheap - the router runs with
 * `defaultPreload: 'intent'`, so hovering a public link runs its `beforeLoad`,
 * and being wrong about a public session for half a minute costs a stale header.
 *
 * An admin permission set is not that. Removing somebody's admin access has to
 * take effect promptly, and every layer below this one is already built for it:
 * `SessionAdminModel.getUser()` re-runs `checkIfUserIsAdmin` against the
 * database even on a cache hit and *deletes the session* the moment the answer
 * turns false, and `staff-permission-cache.ts` keys its 60-second Redis entries
 * by a generation stamp that every role-shaped mutation moves. The API is
 * therefore the thing that caches, with explicit invalidation, and the browser's
 * job is to keep no copy of its own. `getSessionAdminApi()`'s comment says the
 * same thing about the Next.js side.
 *
 * So: `staleTime: 0`. Not a smaller number, and emphatically not `Infinity` - a
 * permission set that never expires is one an administrator keeps for as long as
 * the tab is open, which is precisely the revocation hole this whole feature is
 * shaped to avoid. The cost is one request per admin navigation, against an
 * endpoint whose database work is already cached in Redis.
 */
const ADMIN_SESSION_STALE_TIME = 0;

/**
 * How long a *detached* entry lingers before Query collects it.
 *
 * Short, for the same reason the stale time is zero, and for a second one:
 * `gcTime` is what governs an entry with no observers - the AdminCP left in a
 * background tab, a screen navigated away from. The default five minutes is a
 * five-minute window in which a permission set nobody is rendering is still
 * sitting in memory waiting to be re-adopted.
 *
 * Not zero, though, and the distinction matters. A `0` here collects the entry
 * the instant its last observer unmounts, which includes the gap between a
 * route's loader filling it and the route's component mounting to read it - so
 * the loader's work would be thrown away and the component would fetch again.
 * A minute is long enough that no navigation can fall through it and short
 * enough that nothing survives being walked away from.
 *
 * Neither of these is the mechanism that isolates two administrators. That is
 * {@link removeAdminSession}, which runs on sign-in and sign-out and does not
 * wait for a clock.
 */
const ADMIN_SESSION_GC_TIME = 60_000;

/**
 * The AdminCP session, as VitNode's one query definition.
 *
 * Every caller goes through this - the `_admin` guard, the shell's loader, the
 * permission provider, a component reading a permission back - so all of them
 * share one cache entry and one fetch. Two definitions of the same read would be
 * two entries, and the one the guard filled would not be the one the sidebar
 * renders from.
 *
 * `readAdminSession` is the application's `createServerFn` - the one primitive
 * this package may not declare, which is why it arrives through `./transport` -
 * so the fetch happens on the server both times: directly during SSR, and over
 * same-origin RPC on client navigation, which is what carries the admin cookie
 * to a place that may read it. The browser never talks to the admin session
 * endpoint itself.
 *
 * ## It asks once
 *
 * `retry: false`, departing from Query's default of three attempts with backoff.
 * This read is a route guard, not background content: it runs inside
 * `beforeLoad`, and a navigation is blocked for as long as it takes.
 *
 * Retrying makes every failure worse in the same way. A `429` from the rate
 * limiter is answered by sending the same request two more times, which is the
 * thing the limiter is asking the app to stop doing; a `500` turns one round
 * trip into three before the AdminCP can show anything, so it appears to hang
 * rather than to fail. Neither retry can succeed at anything the first could
 * not - admin access is whatever the cookie and the staff tables say, and asking
 * again does not change either.
 *
 * ## A failure rejects. It never becomes a denial
 *
 * The transport resolves with a discriminated value because a thrown error does
 * not survive a server-function boundary with its kind intact. This is where
 * that value becomes a rejection again: a decision (`granted` or `denied`)
 * resolves, and a failure (`api_error`, `network_error`) throws
 * {@link AdminSessionUnavailableError} carrying which one it was.
 *
 * That is the single most important line in this feature. Resolving a failure as
 * `denied` would take a working administrator during an outage, decide they are
 * not one, and bounce them to a sign-in form for a session they already hold -
 * the exact bug `readSessionOnApi` was rewritten to remove on the public
 * session, and the one the Next.js `getSessionAdminApi()` still has.
 */
export const adminSessionQueryOptions = () =>
  queryOptions({
    gcTime: ADMIN_SESSION_GC_TIME,
    queryFn: async (): Promise<AdminAccessState> => {
      const read = await adminTransport().readAdminSession();

      if (isAdminAccess(read)) return read;

      throw new AdminSessionUnavailableError(read);
    },
    queryKey: ADMIN_SESSION_QUERY_KEY,
    retry: false,
    staleTime: ADMIN_SESSION_STALE_TIME,
  });

/**
 * The admin access decision, reading the session first if what is cached cannot
 * be trusted.
 *
 * What `_admin`'s `beforeLoad` calls, and the only function it needs. It returns
 * the decision material and leaves the decision to the caller: no `redirect()`
 * here on purpose, because where a blocked administrator is sent is a property
 * of the route that blocked them, so it belongs in the route tree - which is
 * also the only layer that should be importing the router.
 *
 * ## Why `fetchQuery` and not `ensureQueryData`
 *
 * They differ in exactly one case, and it is the case a guard exists for.
 * `ensureQueryData` returns whatever is cached the moment anything is cached -
 * no staleness check, and **no check of whether the entry was invalidated**. So
 * a guard reading through it could not see an admin sign-in that had just
 * happened, and would decide on the previous state.
 *
 * `fetchQuery` asks the query itself, through `isStaleByTime`. With
 * {@link ADMIN_SESSION_STALE_TIME} at zero that means it always asks the API,
 * which is the point: this is the one read in VitNode that is deliberately not
 * allowed to be answered from memory.
 *
 * Two routes guarding themselves during one navigation still share the single
 * in-flight request, because `query.fetch()` returns the promise already in
 * flight rather than starting a second one.
 *
 * ## It resolves only when admin access is actually known
 *
 * An `AdminAccessState` comes back when - and only when - the API answered.
 * A read that could not be evaluated rejects, and that rejection is meant to
 * propagate out of `beforeLoad` as an ordinary route error. A caller must
 * therefore not treat a rejection as "not an admin". Only
 * `status === "denied"`, on an answer the API actually gave, means that.
 */
export const ensureAdminAccess = async (
  queryClient: QueryClient,
): Promise<AdminAccessState> =>
  await queryClient.fetchQuery(adminSessionQueryOptions());

/**
 * Fill the admin session entry without letting a failed read take the page down.
 *
 * What the `/admin` sign-in screen's guard calls, and the one place a tolerant
 * read is correct. `ensureAdminAccess` is the wrong tool there in a specific
 * way: it rejects when the session cannot be read, which is exactly right for a
 * guard protecting the AdminCP - an outage must not sign anybody out - and
 * exactly wrong for the sign-in page, where the same rejection would replace the
 * form with an error screen and leave the AdminCP with no way in at all.
 *
 * `prefetchQuery` is the difference: same query definition, same key, same
 * single in-flight request, and a failure is recorded in the cache entry instead
 * of thrown. So the sign-in form renders, and an administrator can sign in
 * during a partial outage.
 *
 * Resolves to the decision when there was one, and `undefined` when there was
 * not - so a caller can only redirect an already-signed-in administrator away
 * from the form on an answer the API actually gave.
 */
export const prefetchAdminAccess = async (
  queryClient: QueryClient,
): Promise<AdminAccessState | undefined> => {
  await queryClient.prefetchQuery(adminSessionQueryOptions());

  return queryClient.getQueryData(adminSessionQueryOptions().queryKey);
};

/**
 * Mark the cached admin session stale, so the next reader fetches the truth.
 *
 * For the mutations that change what an administrator may do without changing
 * *who* they are - editing their own role, a staff permission update applied to
 * themselves. Invalidating rather than removing keeps the current sidebar on
 * screen while the fresh answer is fetched, instead of blanking the shell.
 *
 * Not what a sign-in or a sign-out calls. When the identity behind the cookie
 * changes, keeping the previous answer on screen for even one frame is the thing
 * to avoid - see {@link removeAdminSession} in `./state`.
 */
export const invalidateAdminSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
