import type { SessionApi } from "./session-api";

/**
 * Who is asking, as route state - and nothing else.
 *
 * Pure by construction: a type-only import of `SessionApi`, which TypeScript
 * erases, so this module has no runtime dependencies at all. That is what lets
 * the same rules run in the four places that cannot import each other's
 * runtimes - a `beforeLoad` on the server, the same `beforeLoad` in the browser,
 * a component reading the router context, and the tests - and it is why the
 * query key is defined here rather than next to the query that uses it.
 *
 * ## What this layer is, and what it is not
 *
 *     TanStack beforeLoad  ->  navigation and UI guard
 *     Hono authorization   ->  the security boundary
 *
 * Everything here is derived from a response the browser can read and, after
 * hydration, from a cache the browser owns. It decides what to *render* and
 * where to *navigate*. It decides nothing about what data anybody may read:
 * every private read is authorized on the server by Hono, from the session
 * cookie, in the route's own handler and middleware. If this state were ever
 * treated as authoritative for API access, editing a cache entry in devtools
 * would be a privilege escalation - which is why no VitNode endpoint asks the
 * client who it is.
 *
 * ## Moderators are deliberately absent
 *
 * `session.user.isModerator` exists in the API's response and is hardcoded
 * `false` (`users/routes/session.route.ts`: `// TODO: implement moderator
 * role`). So there is no moderator authorization to model yet, and this state
 * exposes no `isModerator` flag: a guard written against one would read as
 * enforcement while being a constant, and would silently start granting access
 * the day the API begins answering `true`.
 *
 * Nothing renders it either. The user menu used to draw a
 * `/mod_cp` link behind that flag, pointing at a page neither application
 * serves; `userHeaderMenu` in
 * `views/layouts/theme/header/user/user-header-model.ts` branches on `isAdmin`
 * alone. The field stays reachable as `auth.user.isModerator` for whoever
 * implements the role.
 */

/**
 * The signed-in visitor, as the API describes them.
 *
 * Derived from `SessionApi`, never written out again. The shape is a Zod schema
 * in `api/modules/users/routes/session.route.ts` and reaches here through the
 * fetcher's inference, so a field added or renamed there arrives without anybody
 * editing this file. A hand-maintained copy is a second source of truth that
 * typechecks perfectly while disagreeing with the server.
 */
export type AuthUser = NonNullable<SessionApi["user"]>;

/**
 * The auth state a route guard reads.
 *
 * A union rather than one object with four independent fields, so the states
 * that cannot happen cannot be written: there is no guest holding
 * `isAdmin: true`, and `if (auth.isAuthenticated)` narrows `auth.user` to
 * non-null for everything inside the branch. That narrowing is most of the
 * reason this type exists instead of routes poking at `session.user?.isAdmin`
 * themselves.
 *
 * `session` is carried along because a page needs more of it than its guard
 * does - the header renders the user, `ai.models` decides whether the assistant
 * appears - and re-reading the cache to get it back would be a second answer
 * that can disagree with the first.
 */
export type AuthState =
  | {
      isAdmin: boolean;
      isAuthenticated: true;
      session: SessionApi;
      user: AuthUser;
    }
  | {
      isAdmin: false;
      isAuthenticated: false;
      session: SessionApi;
      user: null;
    };

/**
 * The one cache entry a visitor's session lives in.
 *
 * Two segments and no third. In particular **no locale**: the session is who the
 * visitor is, which does not change because they read the page in Polish, and a
 * locale in the key would mean one visitor holding two sessions that are
 * invalidated separately - so a sign-out on `/pl` would leave `/` still showing
 * a signed-in header. Contrast `intlQueryPrefix` in `lib/i18n/query.ts`, where
 * the locale belongs in the key because the *value* differs per language.
 *
 * Nothing else may be added either. A key that varies by route or by user id is
 * a key the next caller cannot reconstruct, and the whole point of a single
 * entry is that sign-in and sign-out know exactly what to replace.
 */
export const SESSION_QUERY_KEY = ["vitnode", "session"] as const;

/**
 * The session, as the auth state a guard reads.
 *
 * Total and pure: one argument in, one object out. No I/O, no router, no clock,
 * no `window`. `beforeLoad` runs on hover under `defaultPreload: 'intent'`, so
 * anything with a side effect here would be a side effect nobody asked for -
 * this function cannot create a session, end one, or redirect, because it cannot
 * do anything at all.
 *
 * `user === null` is the only test for "signed out", and it means exactly one
 * thing: **the API answered, and nobody is signed in.** No cookie and an expired
 * session both arrive that way, because both are a successful read of "there is
 * no session here".
 *
 * ## A failed read never reaches this function
 *
 * It used to. The session read once returned `{ ai: { models: [] }, user: null }`
 * for every non-200, so a `429` from the rate limiter, a `500` or an unreachable
 * API arrived here indistinguishable from a guest - and `canAccessAuthenticatedRoute`
 * dutifully signed a signed-in visitor out of a page they were entitled to.
 *
 * That normalisation is gone deliberately. `readSessionOnApi` in `./server` now
 * *rejects* when the session could not be read, which propagates through
 * `ensureAuthState` and out of the guard's `beforeLoad` as an ordinary route
 * error - so the visitor stays where they are and sees a failure, rather than
 * being told they are anonymous. There is no third {@link AuthState} for "we
 * could not find out", and there must not be one: the two states below are both
 * answers, and an outage is not an answer.
 *
 * So this function is total over what it can actually receive - every
 * `SessionApi` value is a session the API returned - and a caller must never
 * read a rejection as a guest.
 */
export const authStateFromSession = (session: SessionApi): AuthState => {
  const { user } = session;

  if (!user) {
    return { isAdmin: false, isAuthenticated: false, session, user: null };
  }

  return { isAdmin: user.isAdmin, isAuthenticated: true, session, user };
};

/**
 * The half of {@link AuthState} that has a visitor in it.
 *
 * Named so a guard can hand it downwards as route context: everything under
 * `_authenticated` reads `context.auth.user` without a null check, because the
 * boundary already made it.
 */
export type AuthenticatedState = Extract<AuthState, { isAuthenticated: true }>;

/**
 * A page only a signed-in visitor may see - `/settings`, `/files`.
 *
 * A named predicate rather than `auth.isAuthenticated` at each call site: what a
 * route declares is the *kind* of page it is, and what that requires is decided
 * once, here. The Next.js app spells the same rule as
 * `if (!session.user) notFound()` inside `LayoutSettings`.
 *
 * Written as a type predicate so the narrowing survives the call. A `boolean`
 * would leave `auth.user` nullable on the *other* side of the guard, and every
 * protected page would re-check something the boundary already proved - or, more
 * likely, assert it away.
 */
export const canAccessAuthenticatedRoute = (
  auth: AuthState,
): auth is AuthenticatedState => auth.isAuthenticated;

/**
 * A page that only makes sense signed *out* - `/login`, `/register`.
 *
 * The inverse of the rule above and not an independent one, so the two cannot
 * drift into disagreeing about what "signed in" means.
 */
export const canAccessGuestRoute = (auth: AuthState): boolean =>
  !auth.isAuthenticated;

/**
 * A route that is only offered to a visitor with admin permissions.
 *
 * `isAdmin` is computed server-side per request by `SessionAdminModel`
 * `.checkIfUserIsAdmin`, against the staff permission tables, and is
 * deliberately re-checked rather than cached - removing someone takes effect on
 * their next request.
 *
 * Note what it does *not* mean. The AdminCP runs on a **second session**, its
 * own cookie and its own sign-in (`getSessionAdminApi`, `SessionAdminModel`), so
 * `isAdmin` says "this visitor may be offered the AdminCP", not "this visitor is
 * inside it". Entry to the AdminCP is gated by that separate session on the
 * server, and this predicate is not a substitute for it.
 */
export const canAccessAdminRoute = (auth: AuthState): boolean => auth.isAdmin;
