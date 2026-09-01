import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

import type { CoreRouteFactory } from "../types";

import { loadDiscoverRoute } from "../../search/discover-route";
import { normalizeSearchRouteSearch } from "../../search/route-search";
import { loadSearchRoute } from "../../search/search-route";
import { routeContext, routeSearch } from "../types";

/**
 * `/discover` - the public feed.
 *
 * One route serving two public URLs. `/discover` and `/pl/discover` match this
 * one: the locale is stripped before matching and written back into every link
 * the router builds, so nothing here mentions a language and there is no
 * `/pl/discover` to keep in step.
 *
 * Everything the page *is* - which namespaces it warms, the feed it ensures, the
 * two strings its heading and tab title share, and the markup below both - is
 * `../../search`.
 *
 * A search result points wherever the indexed content lives, and the shared feed
 * is host-neutral by design, so the link is a required prop rather than an
 * import and core's own `RouterLink` supplies it. External and unsafe URLs never
 * reach it: `SearchFeedContent` classifies those and renders them itself.
 */
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

/**
 * `/search` - the same feed, with a query.
 *
 * The search box, the type filters, the sort, the feed, the namespaces they are
 * translated through and the one query definition the loader and the controls
 * share are all `../../search`.
 */
const searchRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The loader re-runs when the term in the URL changes, and only then.
     * Without this it would warm the feed for whatever term the page was first
     * opened with and never again, so following a link from `/search?search=hono`
     * to `/search?search=drizzle` would render the first result set and fetch the
     * second from the browser.
     */
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
