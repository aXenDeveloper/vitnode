import type { AnyRoute } from "@tanstack/react-router";

import { createRoute } from "@tanstack/react-router";

import type { CorePageHead } from "../types";
import type { CoreRootRouteContext, CoreRootRouteFactory } from "./types";

import { adminSignInRoute } from "./admin-sign-in";
import { coreAuthRoutes } from "./auth";
import { ssoCallbackRoute } from "./sso";

export type { CoreRootRouteContext, CoreRootRouteFactory } from "./types";

/**
 * The pathless route core's shell-less screens are mounted under.
 *
 * The same device the other two containers are, for the same two reasons: it
 * contributes no URL segment, so `/login` is served at `/login`; and it makes
 * the composition **idempotent** - the subtree is one identifiable child of the
 * root, so re-running it replaces itself instead of appending a second copy of
 * every screen.
 */
export const CORE_ROOT_ROUTES_ROUTE_ID = "_core-root";

/**
 * Every screen `@vitnode/core` owns that renders **outside** a shell.
 *
 * Which is what makes them a group. `/login`, `/register`,
 * `/login/reset-password` and `/login/sso/:providerId` deliberately have no site
 * header - an auth card is the whole page - and `/admin` is the AdminCP's own
 * sign-in, which must sit *outside* the AdminCP shell or its guard would loop.
 */
const CORE_ROOT_ROUTES: CoreRootRouteFactory[] = [
  ...coreAuthRoutes,
  ssoCallbackRoute,
  adminSignInRoute,
];

/**
 * Mounts core's shell-less screens on a route tree, and hands the tree back.
 *
 *     const routeTree = withCoreRootRoutes(routeTree, {
 *       localeRouting,
 *       mountUnder: routeTree,
 *       pageHead,
 *     })
 *
 * `mountUnder` is the **root route** - the tree itself - because these screens
 * have no shell above them. That is also the whole of why they are a separate
 * mount rather than a third area of the other two: an area names a shell, and
 * the absence of one is not a shell.
 *
 * ## Why `localeRouting` is injected and `pageHead` is not enough
 *
 * A sign-in performs a navigation nobody clicked, to a path a *visitor* supplied
 * through `?returnTo=`. The route tree carries no locale, so what the router is
 * handed must not either - and stripping the prefix means knowing which prefixes
 * exist, which is the installation's answer and not this package's. See
 * `createAuthNavigation` in `@vitnode/core/tanstack/auth`; the app's own
 * `localeRouting` is the same object its router's `rewrite` uses, so the strip
 * and the write-back are one rule running in two directions.
 *
 * ## Idempotent, and a good neighbour
 *
 * Siblings are preserved, so this composes with the other mounts in any order -
 * each rebuilds only the container it owns - and calling it twice is the same as
 * calling it once.
 */
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
