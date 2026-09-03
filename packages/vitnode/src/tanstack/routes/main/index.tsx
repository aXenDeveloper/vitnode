import type { AnyRoute } from "@tanstack/react-router";

import { createRoute, redirect } from "@tanstack/react-router";

import type {
  CoreAuthRouteContext,
  CoreAuthRouteFactory,
  CorePageHead,
  CoreRouteFactory,
} from "../types";

import { LOGIN_PATH, returnToFor } from "../../auth/redirects";
import { ensureAuthState } from "../../auth/session-query";
import { canAccessAuthenticatedRoute } from "../../auth/state";
import { GuardedOutlet } from "../../pending/guard-pending";
import { routeContext } from "../types";
import { coreAuthRoutes } from "./auth";
import { coreDiscoveryRoutes } from "./discovery";
import { myFilesRoute } from "./files";
import { notFoundRoute } from "./not-found";
import { settingsRoute } from "./settings";
import { ssoCallbackRoute } from "./sso";

export type {
  CoreAuthRouteContext,
  CoreAuthRouteFactory,
  CorePageHead,
  CoreRouteContext,
  CoreRouteFactory,
} from "../types";

export const CORE_MAIN_ROUTES_ROUTE_ID = "_core-main";

export const CORE_AUTHENTICATED_ROUTES_ROUTE_ID = "_core-authenticated";

const CORE_PUBLIC_ROUTES: CoreAuthRouteFactory[] = [
  ...coreDiscoveryRoutes,
  ...coreAuthRoutes,
  ssoCallbackRoute,
  notFoundRoute,
];

/** Core's screens that require a signed-in visitor. */
const CORE_AUTHENTICATED_ROUTES: CoreRouteFactory[] = [
  myFilesRoute,
  settingsRoute,
];

const authenticatedContainer = (parentRoute: AnyRoute): AnyRoute =>
  createRoute({
    getParentRoute: () => parentRoute,
    id: CORE_AUTHENTICATED_ROUTES_ROUTE_ID,
    beforeLoad: async ({ context, location }) => {
      const auth = await ensureAuthState(
        routeContext<{
          queryClient: Parameters<typeof ensureAuthState>[0];
        }>(context).queryClient,
      );

      if (!canAccessAuthenticatedRoute(auth)) {
        // TanStack Router's own control-flow signal: `redirect()` returns a
        // typed redirect object that the router catches and turns into a
        // navigation (or, during SSR, a 302). Throwing it is what stops the
        // guard - and what narrows the code below.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw redirect({
          search: {
            // The *internal* path - the locale has already been stripped by the
            // rewrite - so the value that round-trips through the login URL
            // carries no language, and the prefix is written back exactly once,
            // by the rewrite, when the router builds the way home.
            returnTo: returnToFor(location),
          },
          to: LOGIN_PATH,
        });
      }

      return { auth };
    },

    component: GuardedOutlet,
  });

export const withCoreMainRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  {
    localeRouting,
    mountUnder,
    pageHead,
  }: {
    localeRouting: CoreAuthRouteContext["localeRouting"];
    mountUnder: AnyRoute;
    pageHead: CorePageHead;
  },
): TRouteTree => {
  const mounted: AnyRoute[] = mountUnder.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) =>
      (child.options as { id?: string }).id !== CORE_MAIN_ROUTES_ROUTE_ID,
  );

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: CORE_MAIN_ROUTES_ROUTE_ID,
  });
  const authenticated = authenticatedContainer(container);

  authenticated.addChildren(
    CORE_AUTHENTICATED_ROUTES.map(build =>
      build({ pageHead, parentRoute: authenticated }),
    ),
  );
  container.addChildren([
    ...CORE_PUBLIC_ROUTES.map(build =>
      build({ localeRouting, pageHead, parentRoute: container }),
    ),
    authenticated,
  ]);
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
