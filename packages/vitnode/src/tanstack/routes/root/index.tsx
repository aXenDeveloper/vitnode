import type { AnyRoute } from "@tanstack/react-router";

import { createRoute } from "@tanstack/react-router";

import type { CorePageHead } from "../types";
import type { CoreRootRouteContext, CoreRootRouteFactory } from "./types";

import { adminSignInRoute } from "./admin-sign-in";

export type { CoreRootRouteContext, CoreRootRouteFactory } from "./types";

export const CORE_ROOT_ROUTES_ROUTE_ID = "_core-root";

const CORE_ROOT_ROUTES: CoreRootRouteFactory[] = [adminSignInRoute];

export const withCoreRootRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  {
    localeRouting,
    mountUnder,
    pageHead,
  }: {
    localeRouting: CoreRootRouteContext["localeRouting"];
    mountUnder: AnyRoute;
    pageHead: CorePageHead;
  },
): TRouteTree => {
  const mounted: AnyRoute[] = mountUnder.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) =>
      (child.options as { id?: string }).id !== CORE_ROOT_ROUTES_ROUTE_ID,
  );

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: CORE_ROOT_ROUTES_ROUTE_ID,
  });

  container.addChildren(
    CORE_ROOT_ROUTES.map(build =>
      build({ localeRouting, pageHead, parentRoute: container }),
    ),
  );
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
