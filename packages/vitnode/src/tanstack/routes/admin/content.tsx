import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { ContentListRouteSearch } from "../../admin/content/route-search";
import type { AdminScreenContext } from "../../admin/screen";
import type { CoreAdminRouteContext, CoreRouteFactory } from "../types";

import { ContentAdminBreadcrumbContent } from "../../admin/content/breadcrumb";
import { breadcrumbGroup } from "../../breadcrumb/model";
import { TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

export const contentAdminRoute: CoreRouteFactory<CoreAdminRouteContext> = ({
  loadContentRegistry,
  pageHead,
  parentRoute,
}) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    validateSearch: (search: Record<string, unknown>): ContentListRouteSearch =>
      search as ContentListRouteSearch,
    /** The whole search: which page, sort, search term and filters to load. */
    loaderDeps: ({ search }) => ({
      search: routeSearch<ContentListRouteSearch>(search),
    }),

    // `head` after `loader`, always.
    loader: async ({ context, deps, params }) => {
      const [
        { contentRouteSegments, loadContentAdminRoute },
        { loadContentFormScreen },
        registry,
      ] = await Promise.all([
        import("../../admin/content/route"),
        import("../../admin/content/form/route"),
        loadContentRegistry(),
      ]);

      const resolved = await loadContentAdminRoute({
        ...routeContext<AdminScreenContext>(context),
        registry,
        search: deps.search,
        segments: contentRouteSegments((params as { _splat?: string })._splat),
      });

      return {
        ...resolved,
        ...(await loadContentFormScreen({
          ...routeContext<AdminScreenContext>(context),
          registry,
          route: resolved,
        })),
      };
    },
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/content/$",
    pendingComponent: TablePendingSkeleton,
  });

  route.update({
    staticData: {
      breadcrumb: breadcrumbGroup(ContentAdminBreadcrumb),
    },
    component: lazyRouteComponent(async () => {
      const [{ ContentAdminScreenContent }, registry] = await Promise.all([
        import("../../admin/content/screen"),
        loadContentRegistry(),
      ]);

      return {
        default: function ContentAdminRoute() {
          const navigate = route.useNavigate();

          return (
            <ContentAdminScreenContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ContentListRouteSearch;
                }) => {
                  await navigate({ resetScroll, search });
                },
                [navigate],
              )}
              registry={registry}
              search={route.useSearch()}
            />
          );
        },
      };
    }),
  });

  function ContentAdminBreadcrumb() {
    return <ContentAdminBreadcrumbContent {...route.useLoaderData()} />;
  }

  return route;
};
