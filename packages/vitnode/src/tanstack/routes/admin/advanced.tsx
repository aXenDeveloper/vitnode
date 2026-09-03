import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import { adminBreadcrumb } from "../../admin/breadcrumb";
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

const cronRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

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
      breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "cron"] }),
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

const queueRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

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
      breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "queue"] }),
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
      breadcrumb: adminBreadcrumb({ segments: ["core", "advanced", "search"] }),
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

export const coreAdvancedRoutes: CoreRouteFactory[] = [
  cronRoute,
  queueRoute,
  searchIndexRoute,
];
