import type { QueryClient } from "@tanstack/react-query";

import type {
  PermissionsStaffArgs,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import {
  EMPTY_STAFF_PERMISSION_SET,
  hasStaffPermission,
} from "@/api/lib/staff-permission";
import { CONFIG_PLUGIN } from "@/config";

/**
 * Whether somebody is inside the AdminCP - as route state, and nothing else.
 *
 * Pure by construction: the only runtime imports are the permission predicate
 * every frontend already shares and the core plugin id. That is what lets the
 * same rules run in the places that cannot reach each other's runtimes - a
 * `beforeLoad` on the server, the same `beforeLoad` in the browser, a component
 * reading a provider, and the tests - and it is why the query key is defined
 * here rather than beside the query that uses it.
 *
 * ## What this layer is, and what it is not
 *
 *     TanStack beforeLoad  ->  navigation and UI guard
 *     Hono authorization   ->  the security boundary
 *
 * `api/config.ts` puts `globalAdminMiddleware()` in front of every request whose
 * path contains `/admin/`, and `SessionAdminModel.getUser()` re-runs
 * `checkIfUserIsAdmin` against the database even on a cache hit, deleting the
 * session the moment the answer turns false. None of that moves here and none of
 * it may be relaxed because of what this module decides. Everything below is
 * derived from a response the browser can read, so it decides what to *render*
 * and where to *navigate* - if it were ever treated as authorization, editing a
 * cache entry in devtools would be a privilege escalation.
 *
 * ## The public session is a different question
 *
 * `AuthState.isAdmin`, from `tanstack/auth`, means "this visitor may be
 * *offered* the AdminCP" - it is a flag on the public session, under the public
 * cookie. Being *inside* the AdminCP is a second session under a second cookie
 * (`vitnode_auth_admin`), with its own endpoint and its own expiry. Conflating
 * them would let a public session decide an admin question, so they stay two
 * queries that never read each other.
 */

/**
 * The one cache entry every admin guard, provider and component reads.
 *
 * Two segments, and deliberately nothing else - no locale, because permissions
 * are not translated, and **no user id**. The temptation to key by the signed-in
 * user is real and wrong: the browser does not know who the admin cookie belongs
 * to until this very query answers, so a user id in the key would have to come
 * from the public session - a different cookie, which can name a different
 * person or nobody at all. Isolation between two admins is bought by *lifetime*
 * instead, which is stated under {@link removeAdminSession}.
 */
export const ADMIN_SESSION_QUERY_KEY = ["vitnode", "admin-session"] as const;

/**
 * The AdminCP's front door: the sign-in screen, and where a visitor without
 * admin access is sent.
 *
 * Un-prefixed, and it stays that way in every language.
 * `DEFAULT_IGNORED_LOCALE_PATHS` in `lib/i18n/locale-routing.ts` lists `/admin`
 * with its descendants, so the rewrite never strips a prefix from an admin URL
 * and never writes one back. Nothing in this feature concatenates a language
 * onto these constants, and `admin-locale.test.ts` pins that `/pl/admin` is not
 * a shape any of it can produce.
 */
export const ADMIN_ENTRY_PATH = "/admin";

/** The AdminCP's landing page - where a finished sign-in goes by default. */
export const ADMIN_HOME_PATH = "/admin/core";

/** The search parameter carrying where a blocked admin was heading. */
export const ADMIN_RETURN_TO_PARAM = "returnTo";

/**
 * A decision the API actually made about admin access.
 *
 * Two members, because the endpoint answers exactly two things: `200` with a
 * session, or `403`. Anything else is not a decision - see
 * {@link AdminSessionFailure} - and there is deliberately no third member for
 * "we could not find out", because a caller that can pattern-match on one would
 * eventually treat it as "no".
 *
 * Generic over the session body so this module stays free of the fetcher's
 * inference. `AdminAccessState` in `./session-api` is the concrete alias every
 * consumer actually uses.
 */
export type AdminAccess<TSession> =
  AdminSessionDenied | AdminSessionGranted<TSession>;

/** The API answered `200`: this browser holds an admin session. */
export interface AdminSessionGranted<TSession> {
  session: TSession;
  status: "granted";
}

/** The API answered `403`: this browser holds no admin session. */
export interface AdminSessionDenied {
  status: "denied";
}

/**
 * A read that produced no decision at all.
 *
 * Split in two because the difference is the difference between "the API said
 * no" and "the API never got to say anything", and an operator staring at an
 * AdminCP that will not open needs to be told which. Neither is a permission
 * outcome:
 *
 * - `api_error` - the API answered, with something that is not `200` or `403`.
 *   A `429` from the rate limiter and a `500` from a failing query both land
 *   here. `httpStatus` is carried when a response was actually received, because
 *   it is the one detail that is safe to show and useless to withhold; the
 *   response *body* is not, and never leaves the server - see
 *   `readAdminSessionOnApi`. It is absent when the failure was raised rather
 *   than returned: `rawApiFetch` throws on a `500` instead of handing one back,
 *   and a body that will not parse as JSON throws too, so there is no status to
 *   quote without inventing one.
 * - `network_error` - the call itself failed. Nothing was received, so there is
 *   no status to report at all.
 *
 * Mapping either of these onto `denied` is the bug this whole union exists to
 * prevent: it would sign every administrator out of the AdminCP during an
 * outage, and - because the sign-in screen is where a denied admin is sent -
 * present them with a login form for a session they already have.
 */
export type AdminSessionFailure =
  { httpStatus?: number; status: "api_error" } | { status: "network_error" };

/** Everything a read of the admin session endpoint can produce. */
export type AdminSessionRead<TSession> =
  AdminAccess<TSession> | AdminSessionFailure;

/** Whether a read produced a decision rather than a failure. */
export const isAdminAccess = <TSession>(
  read: AdminSessionRead<TSession>,
): read is AdminAccess<TSession> =>
  read.status === "granted" || read.status === "denied";

/**
 * What a status that is not `200` describes: a denial, or a failure.
 *
 * The load-bearing half of the status policy, and the reason it is written as an
 * allowlist rather than as `status >= 400 ? denied : granted`. The failure mode
 * of the inverted spelling is silent: a `204`, a `302` that a redirect-following
 * fetch turned into somebody's login page, an HTML error page from a proxy in
 * front of the API - under a "not 200 means no" rule every one of those is read
 * as an administrator who holds no permissions, and the AdminCP quietly empties
 * itself. Only `403` is a decision, because `403` is the only thing the session
 * route answers when it has decided.
 *
 * Its own function, separate from {@link adminSessionReadFromStatus}, so the
 * server read can call it without a session body in scope and still be inferred
 * as `AdminSessionRead<TheSessionShape>` rather than as a union widened by an
 * absent one.
 */
export const adminSessionFailureFromStatus = (
  status: number,
): AdminSessionDenied | AdminSessionFailure =>
  status === 403
    ? { status: "denied" }
    : { httpStatus: status, status: "api_error" };

/**
 * The read a status code describes, with the session body when there is one.
 *
 * The whole status policy as one total function - `200` with a body is the only
 * success - so the table can be exercised in a test without a server. A `200`
 * carrying no body is *not* a success: the route's `200` is declared with a
 * schema, so an empty one is a reply this layer cannot honour, and calling it a
 * grant would hand `undefined` to everything that reads `session.permissions`.
 */
export const adminSessionReadFromStatus = <TSession>(
  status: number,
  session?: TSession,
): AdminSessionRead<TSession> => {
  if (status === 200) {
    return session === undefined
      ? { httpStatus: status, status: "api_error" }
      : { session, status: "granted" };
  }

  return adminSessionFailureFromStatus(status);
};

/**
 * A raised error as one of the two failure kinds.
 *
 * `fetch` rejects with a `TypeError` when the request never completed - DNS,
 * connection refused, TLS, an aborted socket - in undici (`fetch failed`) and in
 * every browser (`Failed to fetch`). Everything else that reaches this point
 * came from an API that *did* answer: `rawApiFetch` throws its own `Error` for a
 * `500`, and a reply whose body will not parse as JSON throws from `json()`.
 *
 * So the check is narrow on purpose, and it errs in the safe direction. A
 * `TypeError` from somewhere unexpected would be reported as a network problem
 * rather than an API one, which is a worse *diagnosis* and not a worse
 * *decision* - both reject, and neither becomes a permission outcome.
 */
export const adminSessionFailureFromError = (
  error: unknown,
): AdminSessionFailure =>
  error instanceof TypeError
    ? { status: "network_error" }
    : { status: "api_error" };

/**
 * The sentence a caller gets when the admin session could not be read.
 *
 * Fixed, and a named constant so a test can assert on it without matching
 * English. Deliberately says nothing about *why*: the underlying error carries
 * the failing API URL and the server's own error text, it has already been
 * written to the server log, and this value is rendered in a browser.
 */
export const ADMIN_SESSION_UNAVAILABLE =
  "The admin session could not be read. This is not a permission decision - try again.";

/**
 * The rejection a failed admin-session read becomes.
 *
 * A class rather than a plain `Error` so an error boundary can tell this apart
 * from anything else a route threw, and so `failure` survives to whoever renders
 * it - the difference between "the API is rate-limiting us" and "the API is not
 * answering" is the whole reason {@link AdminSessionFailure} has two members.
 *
 * Constructed in the query function, on whichever side of the render is reading
 * - never carried across a server-function boundary, where a custom class would
 * arrive as a plain object with its prototype gone. What crosses that boundary
 * is the plain {@link AdminSessionRead} value, and this is built from it here.
 */
export class AdminSessionUnavailableError extends Error {
  constructor(failure: AdminSessionFailure) {
    super(ADMIN_SESSION_UNAVAILABLE);
    this.name = "AdminSessionUnavailableError";
    this.failure = failure;
  }

  // Assigned in the body rather than declared as a constructor parameter
  // property: the package compiles with `erasableSyntaxOnly`, so every construct
  // that needs TypeScript to emit runtime code is out.
  readonly failure: AdminSessionFailure;
}

/** Whether an admin may enter the AdminCP shell. */
export const canEnterAdmin = <TSession>(
  access: AdminAccess<TSession>,
): boolean => access.status === "granted";

/**
 * The permission set an access decision carries.
 *
 * `EMPTY_STAFF_PERMISSION_SET` for a denial, and that is a *real answer*: the
 * API was asked and said this browser holds no admin session, so it holds no
 * admin permissions. It is never the answer to a failed read, because a failed
 * read never becomes an `AdminAccess` in the first place - the query rejects
 * instead. That distinction is the entire reason this function takes a decision
 * rather than a nullable session.
 */
export const adminPermissionsOf = <TSession extends { permissions: unknown }>(
  access: AdminAccess<TSession>,
): StaffPermissionSet =>
  access.status === "granted"
    ? (access.session.permissions as StaffPermissionSet)
    : EMPTY_STAFF_PERMISSION_SET;

/**
 * Whether this admin holds a permission - the AdminCP's `checkAdminPermissionApi`,
 * with the session handed in rather than fetched.
 *
 * `hasStaffPermission` is the canonical predicate and stays canonical; this adds
 * exactly two things, and both are things the Next.js helper already did:
 * reading the set off an access decision, and defaulting `plugin` to
 * `@vitnode/core` so a core screen names two fields instead of three. A plugin's
 * own screen passes its `pluginId` explicitly - which is the point, because a
 * permission granted under core must not open a plugin's page.
 *
 * `root` short-circuits inside `hasStaffPermission`, so nothing here needs to
 * know that root exists.
 */
export const hasAdminPermission = <TSession extends { permissions: unknown }>(
  access: AdminAccess<TSession>,
  {
    module,
    permission,
    plugin = CONFIG_PLUGIN.pluginId,
  }: Omit<PermissionsStaffArgs, "plugin"> & { plugin?: string },
): boolean =>
  hasStaffPermission(adminPermissionsOf(access), {
    module,
    permission,
    plugin,
  });

/**
 * Forget the admin session entirely, rather than marking it stale.
 *
 * The half that keeps one administrator's permissions out of the next one's
 * browser. The `QueryClient` is created once per server request and once per
 * browser (`getRouter()` in `apps/web/src/router.tsx`), so the server side is
 * safe by lifetime - one request, one client, one visitor. The browser's client
 * is not: it outlives a sign-out, and the tab that Admin A signed out of is the
 * tab Admin B signs in to.
 *
 * `removeQueries` rather than `invalidateQueries`, and the difference is
 * load-bearing. Invalidation *keeps the value* and marks it stale, so the shell
 * would go on rendering A's sidebar - every entry A's permissions unlocked -
 * until a refetch returned. Removal deletes it, so the next reader has nothing
 * to render from and must ask the API, which reads the cookie the browser now
 * holds.
 *
 * Called on both sign-out flavours and after an admin sign-in. The public
 * sign-out is included on purpose even though it does not touch the admin
 * cookie: the person in front of the browser may have changed, and the correct
 * response to "who is this?" becoming uncertain is to re-derive the answer from
 * the cookie rather than to reuse the last one.
 */
export const removeAdminSession = (queryClient: QueryClient): void => {
  queryClient.removeQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
};
