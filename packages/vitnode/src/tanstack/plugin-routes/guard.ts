import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import type { PluginRouteRequirement } from "@/routing";

import type { AuthState } from "../auth/state";

import {
  LOGIN_PATH,
  parseInternalDestination,
  postAuthDestination,
  returnToFor,
} from "../auth/redirects";
import { ensureAuthState } from "../auth/session-query";
import {
  canAccessAuthenticatedRoute,
  canAccessGuestRoute,
} from "../auth/state";

/**
 * Who a plugin route is offered to, enforced before its chunk is fetched.
 *
 * The requirement is manifest *data* rather than something the module exports,
 * and this is the whole argument for that split: the check runs in `beforeLoad`,
 * which is before the route's module is downloaded. A requirement that lived in
 * the module could only be read by fetching the page it was meant to withhold.
 *
 * ## It is not the security boundary, and may never become one
 *
 * Every private read is authorized by Hono on the server, from the session
 * cookie, in the route's own handler. What this decides is whether a browser is
 * sent somewhere else *before* the page renders - the difference between a
 * signed-out visitor seeing a flash of a private page and never receiving a byte
 * of it. A visitor who edits their cached session in devtools gets a page shell
 * and an API that still refuses them.
 *
 * ## Nothing new is invented here
 *
 * `ensureAuthState`, `canAccessAuthenticatedRoute`, `canAccessGuestRoute`,
 * `LOGIN_PATH`, `returnToFor` and `postAuthDestination` are Stage 6's, unchanged
 * and shared with the host's own `_authenticated` boundary and `/login`. There
 * is deliberately no plugin auth context, no plugin session store and no second
 * cache entry: the QueryClient the host already owns holds the session under one
 * key, and a plugin route reads exactly that one.
 *
 * A failed session read is left to propagate. `ensureAuthState` rejects when the
 * session could not be read at all - a rate limit, a 500, an API that is not
 * listening - and only `canAccess…` answering `false` on a session the API
 * actually returned sends anybody anywhere. Catching the rejection would sign a
 * visitor out because of an outage.
 */

/** The narrowest slice of a route's context these guards read. */
export interface PluginRouteGuardContext {
  queryClient: QueryClient;
}

/** The narrowest slice of `beforeLoad`'s arguments these guards read. */
export interface PluginRouteGuardArgs {
  context: PluginRouteGuardContext;
  location: { hash?: string; pathname: string; searchStr?: string };
  search: unknown;
}

/**
 * A plugin route's `beforeLoad`, or nothing when it is offered to everybody.
 *
 * Built per route rather than registered once on the plugin container, because
 * the container is the parent of *every* plugin route and a guard there would
 * apply to all of them. A nested route inherits its layout's guard the way any
 * route inherits a parent's `beforeLoad` - by being underneath it - which is
 * also why `buildPluginRouteGraph` refuses a guest-only page inside an
 * authenticated layout: it would be a route no visitor could ever reach.
 *
 * `authenticated` returns the resolved state, so a nested plugin route's
 * `context.auth` is the same object the guard decided on and cannot disagree
 * with the rule that admitted the navigation.
 */
export const pluginRouteGuard = (
  requires: null | PluginRouteRequirement,
):
  | ((args: PluginRouteGuardArgs) => Promise<undefined | { auth: AuthState }>)
  | undefined => {
  if (requires === null) return undefined;

  if (requires === "authenticated") {
    return async ({ context, location }) => {
      const auth = await ensureAuthState(context.queryClient);

      if (canAccessAuthenticatedRoute(auth)) return { auth };

      // TanStack Router's own control-flow signal: `redirect()` returns a typed
      // redirect object the router catches and turns into a navigation, or a
      // 302 during SSR. Throwing it is what stops the guard.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        // The *internal* path - the locale has already been stripped by the
        // rewrite - so the value that round-trips through the login URL carries
        // no language, and the prefix is written back exactly once, by the
        // rewrite, when the router builds the way home.
        search: { returnTo: returnToFor(location) },
        to: LOGIN_PATH,
      });
    };
  }

  return async ({ context, search }) => {
    const auth = await ensureAuthState(context.queryClient);

    if (canAccessGuestRoute(auth)) return undefined;

    const { returnTo } = (search ?? {}) as { returnTo?: unknown };

    // `to`/`search`/`hash` rather than `href`: a redirect carrying `href` is
    // used verbatim by `Router.resolveRedirect`, so it never reaches
    // `buildLocation` and never runs the locale rewrite - a Polish visitor would
    // land on the English page. `postAuthDestination` has already refused every
    // origin, scheme and login-loop spelling, and falls back to `/`.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(parseInternalDestination(postAuthDestination(returnTo)));
  };
};
