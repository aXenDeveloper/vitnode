import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import { AdminBreadcrumb } from "../../admin/breadcrumb";
import { loadAdminCronRoute } from "../../admin/cron/route";
import {
  cronRouteParams,
  normalizeCronRouteSearch,
} from "../../admin/cron/route-search";
import { loadAdminQueueRoute } from "../../admin/queue/route";
import {
  normalizeQueueRouteSearch,
  queueRouteParams,
} from "../../admin/queue/route-search";
import { loadAdminSearchIndexRoute } from "../../admin/search-index/route";
import { normalizeSearchIndexRouteSearch } from "../../admin/search-index/route-search";
import { TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

/**
 * `/admin/core/advanced/cron` - the cron list.
 *
 * The query, the permission (`cron.can_view`), the namespaces, the title and the
 * table are all `../cron`.
 *
 * No locale prefix, in any language: `DEFAULT_IGNORED_LOCALE_PATHS` lists
 * `/admin` with its descendants, so the rewrite neither strips one nor writes
 * one. Nothing here mentions a language, and `robots` is the shell's.
 */
const cronRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The request, as the only thing the loader re-runs for.
     *
     * The *normalised* parameters rather than the raw search. The router hands
     * `loaderDeps` the validated search merged over everything else that was in
     * the query string, so keying on it directly would re-run the loader for a
     * stray `?utm_source=` - and, worse, would treat `?first=10` and no `first`
     * as two different pages of the same rows.
     */
    loaderDeps: ({ search }) => ({
      params: cronRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminCronRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/advanced/cron",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeCronRouteSearch,
    staticData: {
      breadcrumb: <AdminBreadcrumb segments={["core", "advanced", "cron"]} />,
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminCronRouteContent } = await import("../../admin/cron/screen");

      return {
        default: function AdminCronRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminCronRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeCronRouteSearch>;
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

/**
 * `/admin/core/advanced/queue` - the background-task queue.
 *
 * The query, the permission (`queue.can_view`), the namespaces, the title, the
 * status filter and the table are `../queue`.
 */
const queueRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The normalised parameters, not the raw search - which for this table
     * includes the status filter, so switching it is a different loader run and
     * a different cache entry rather than the same rows re-rendered.
     */
    loaderDeps: ({ search }) => ({
      params: queueRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminQueueRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/advanced/queue",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeQueueRouteSearch,
    staticData: {
      breadcrumb: <AdminBreadcrumb segments={["core", "advanced", "queue"]} />,
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminQueueRouteContent } =
        await import("../../admin/queue/screen");

      return {
        default: function AdminQueueRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminQueueRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeQueueRouteSearch>;
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

/**
 * `/admin/core/advanced/search` - the search index's health.
 *
 * The status query, the permission (`system.can_view`), the namespaces, the
 * title, both mutations and the collections table are `../search-index`.
 *
 * No `loaderDeps`: the screen is one status read, and `?search=` filters the
 * collection list *in the browser* rather than in a request - the whole list
 * arrives at once. So typing in the search box changes the URL and re-renders,
 * and does not re-run the loader.
 */
const searchIndexRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    // `head` after `loader`, always.
    loader: async ({ context }) =>
      await loadAdminSearchIndexRoute(
        routeContext<AdminScreenContext>(context),
      ),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/advanced/search",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeSearchIndexRouteSearch,
    staticData: {
      breadcrumb: <AdminBreadcrumb segments={["core", "advanced", "search"]} />,
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminSearchIndexRouteContent } =
        await import("../../admin/search-index/screen");

      return {
        default: function AdminSearchIndexRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminSearchIndexRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeSearchIndexRouteSearch>;
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

/**
 * The advanced section.
 *
 * The dashboard at `/admin/core` is deliberately **not** here. It is the one
 * AdminCP screen that stays a route file in the application, and the reason is a
 * hard constraint of the file-based generator rather than a preference: a
 * pathless layout with no file children is dropped from the generated tree
 * outright (`buildRouteTreeConfig` skips it) *and* collapses to `/`, where it
 * collides with the home page. `_admin` needs one file-based child with a real
 * path to exist at all, and the dashboard has been that anchor since it was the
 * shell's first child. See `apps/web/src/routes/_admin/admin.core.index.tsx`.
 */
export const coreAdvancedRoutes: CoreRouteFactory[] = [
  cronRoute,
  queueRoute,
  searchIndexRoute,
];
