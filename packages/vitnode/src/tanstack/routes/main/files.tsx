import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { CoreRouteFactory } from "../types";

import { loadMyFilesRoute } from "../../files/route";
import {
  myFilesRouteParams,
  normalizeMyFilesRouteSearch,
} from "../../files/route-search";
import { TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

export const myFilesRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

    loaderDeps: ({ search }) => ({
      params: myFilesRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadMyFilesRoute({
        ...routeContext<Parameters<typeof loadMyFilesRoute>[0]>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) =>
      pageHead({ robots: "noindex, nofollow", ...loaderData }),
    path: "/files",
    pendingComponent: () => (
      <TablePendingSkeleton className="container mx-auto" />
    ),
    validateSearch: normalizeMyFilesRouteSearch,
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { MyFilesRouteContent } = await import("../../files/screen");

      return {
        default: function MyFilesRoute() {
          const navigate = route.useNavigate();

          return (
            <MyFilesRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeMyFilesRouteSearch>;
                }) => {
                  await navigate({ resetScroll, search });
                },
                [navigate],
              )}
              search={route.useSearch()}
            />
          );
        },
      };
    }),
  });

  return route;
};
