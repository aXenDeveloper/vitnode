import type { AnyRoute } from "@tanstack/react-router";

import { createRoute } from "@tanstack/react-router";

import type { ContentFrontendRegistry } from "../../../content/admin/registry";
import type {
  CoreAdminRouteContext,
  CorePageHead,
  CoreRouteFactory,
} from "../types";

import { coreAdvancedRoutes } from "./advanced";
import { contentAdminRoute } from "./content";
import { coreStaffRoutes } from "./staff";
import { coreSystemRoutes } from "./system";
import { coreUsersRoutes } from "./users";

export type {
  CoreAdminRouteContext,
  CorePageHead,
  CoreRouteFactory,
} from "../types";

export const CORE_ADMIN_ROUTES_ROUTE_ID = "_core-admin";

/** Every AdminCP screen `@vitnode/core` owns. */
const CORE_ADMIN_ROUTES: CoreRouteFactory<CoreAdminRouteContext>[] = [
  ...coreAdvancedRoutes,
  contentAdminRoute,
  ...coreStaffRoutes,
  ...coreSystemRoutes,
  ...coreUsersRoutes,
];

export const withCoreAdminRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  {
    loadContentRegistry,
    mountUnder,
    pageHead,
  }: {
    loadContentRegistry: () => Promise<ContentFrontendRegistry>;
    mountUnder: AnyRoute;
    pageHead: CorePageHead;
  },
): TRouteTree => {
  const mounted: AnyRoute[] = mountUnder.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) =>
      (child.options as { id?: string }).id !== CORE_ADMIN_ROUTES_ROUTE_ID,
  );

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: CORE_ADMIN_ROUTES_ROUTE_ID,
  });

  container.addChildren(
    CORE_ADMIN_ROUTES.map(build =>
      build({ loadContentRegistry, pageHead, parentRoute: container }),
    ),
  );
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
