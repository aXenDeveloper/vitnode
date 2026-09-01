import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { CoreRouteFactory } from "../types";

import { loadMyFilesRoute } from "../../files/route";
import {
  myFilesRouteParams,
  normalizeMyFilesRouteSearch,
} from "../../files/route-search";
import { routeContext, routeSearch } from "../types";

/**
 * `/files` - the visitor's own files.
 *
 * One route serving two public URLs: the locale is stripped before matching and
 * written back into every link the router builds, so nothing here mentions a
 * language.
 *
 * Not to be confused with `/admin/core/system/files`, which is *every* file in
 * the installation - a different endpoint, a different permission and a different
 * cache family.
 */
export const myFilesRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The request, as the only thing the loader re-runs for.
     *
     * The *normalised* parameters rather than the raw search, and that is what
     * makes this exact. The router hands `loaderDeps` the validated search
     * merged over everything else that was in the query string, so keying on it
     * directly would re-run the loader for a stray `?utm_source=` - and, worse,
     * would treat `?first=10` and no `first` as two different pages of the same
     * rows.
     */
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
