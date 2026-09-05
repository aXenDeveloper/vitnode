import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import type { CoreRouteFactory } from "../types";

import { FeedPendingSkeleton } from "../../pending";
import { loadDiscoverRoute } from "../../search/discover-route";
import { normalizeSearchRouteSearch } from "../../search/route-search";
import { loadSearchRoute } from "../../search/search-route";
import { routeContext, routeSearch } from "../types";

const discoverRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    // `head` after `loader`, always: `loaderData` is inferred from `loader`, and
    // TypeScript reads an object literal's members in order.
    loader: async ({ context }) =>
      await loadDiscoverRoute(routeContext(context)),
    head: ({ loaderData }) =>
      pageHead({ robots: "index, follow", ...loaderData }),
    path: "/discover",
    pendingComponent: FeedPendingSkeleton,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ DiscoverRouteContent }, { RouterLink }] = await Promise.all([
        import("../../search/discover-screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function DiscoverRoute() {
          return (
            <DiscoverRouteContent
              {...route.useLoaderData()}
              LinkComponent={RouterLink}
            />
          );
        },
      };
    }),
  });

  return route;
};

const searchRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

    loaderDeps: ({ search }) => ({
      search: routeSearch<{ search: string }>(search).search,
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadSearchRoute({
        ...routeContext<Parameters<typeof loadSearchRoute>[0]>(context),
        search: deps.search,
      }),
    head: ({ loaderData }) =>
      pageHead({ robots: "index, follow", ...loaderData }),
    path: "/search",
    pendingComponent: FeedPendingSkeleton,
    validateSearch: normalizeSearchRouteSearch,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ SearchRouteContent }, { RouterLink }] = await Promise.all([
        import("../../search/search-screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function SearchRoute() {
          return (
            <SearchRouteContent
              {...route.useLoaderData()}
              LinkComponent={RouterLink}
            />
          );
        },
      };
    }),
  });

  return route;
};

/** The two public discovery screens. */
export const coreDiscoveryRoutes: CoreRouteFactory[] = [
  discoverRoute,
  searchRoute,
];
