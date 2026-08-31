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

/**
 * The pathless route core's own AdminCP screens are mounted under.
 *
 * The same device `_plugins` is, for the same two reasons: it contributes no URL
 * segment, so `/admin/core/users` is served at `/admin/core/users`; and it makes
 * the composition **idempotent** - the subtree is one identifiable child of the
 * AdminCP shell, so re-running the composition replaces it instead of appending
 * a second copy of every screen. In dev, Vite re-evaluates the module that
 * composes the tree without re-evaluating `routeTree.gen.ts`, and the route it
 * mutates is the same object.
 */
export const CORE_ADMIN_ROUTES_ROUTE_ID = "_core-admin";

/** Every AdminCP screen `@vitnode/core` owns. */
const CORE_ADMIN_ROUTES: CoreRouteFactory<CoreAdminRouteContext>[] = [
  ...coreAdvancedRoutes,
  contentAdminRoute,
  ...coreStaffRoutes,
  ...coreSystemRoutes,
  ...coreUsersRoutes,
];

/**
 * Mounts core's own AdminCP screens on a route tree, and hands the tree back.
 *
 * ## What this replaced
 *
 * A directory of route files in every application. `apps/web/src/routes/_admin/`
 * held one `createFileRoute` per AdminCP screen, and every one of them was pure
 * wiring: the loader, the component, the breadcrumb and the search normaliser
 * all came from `@vitnode/core`, and the file existed only so that a file-based
 * router would see a path. So an app that installed VitNode carried a copy of
 * VitNode's own routing table, a copy the scaffold shipped to every new project,
 * and core adding a screen was an edit in every application that had one.
 *
 * There is one implementation now, and it is in the package that owns the
 * screens. An application mounts them the way it already mounts a plugin's:
 *
 *     const routeTree = withCoreAdminRoutes(
 *       withPluginRoutes(fileRouteTree, specs, { mountUnder, pageHead }),
 *       { contentRegistry, mountUnder: adminShellRoute, pageHead },
 *     )
 *
 * ## Why not through the plugin route manifest
 *
 * Because these screens need options a lazily-imported module cannot provide.
 * `validateSearch` runs during path matching, before any chunk is fetched, and
 * an AdminCP list keeps its whole state in the query string - `?page=999` is
 * clamped and *redirected* before anything renders, which no loader-time
 * normaliser can do. A splat route (`/admin/content/$`) is not representable in
 * the manifest's path grammar either. Core is not a third-party package and does
 * not need that layer's guarantees about untrusted plugins; what it needs is the
 * router's own option set, which is what a code-based route is.
 *
 * ## Idempotent, and a good neighbour
 *
 * `addChildren` replaces a route's children and mutates in place, so the subtree
 * is rebuilt from the mount point's current children with any previous copy of
 * itself removed - calling this twice is the same as calling it once. Siblings
 * are preserved, which is what lets this and `withPluginRoutes` compose in
 * either order: each rebuilds only the container it owns.
 */
export const withCoreAdminRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  {
    contentRegistry,
    mountUnder,
    pageHead,
  }: {
    contentRegistry: ContentFrontendRegistry;
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
      build({ contentRegistry, pageHead, parentRoute: container }),
    ),
  );
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
