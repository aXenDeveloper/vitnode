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
