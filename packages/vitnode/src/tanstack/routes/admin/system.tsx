import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import { adminBreadcrumb } from "../../admin/breadcrumb";
import { loadAdminDebugRoute } from "../../admin/debug/route";
import {
  debugLogsRouteParams,
  normalizeDebugRouteSearch,
} from "../../admin/debug/route-search";
import { loadAdminFilesRoute } from "../../admin/files/route";
import {
  adminFilesRouteParams,
  normalizeAdminFilesRouteSearch,
} from "../../admin/files/route-search";
import { loadAdminIntegrationsRoute } from "../../admin/integrations/route";
import { CardsPendingSkeleton, TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

const filesRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /** The normalised parameters - this table's search term included. */
    loaderDeps: ({ search }) => ({
      params: adminFilesRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminFilesRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/system/files",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeAdminFilesRouteSearch,
    staticData: {
      breadcrumb: adminBreadcrumb({ segments: ["core", "system", "files"] }),
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminFilesRouteContent } =
        await import("../../admin/files/screen");

      return {
        default: function AdminFilesRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminFilesRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeAdminFilesRouteSearch>;
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

const integrationsRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    // `head` after `loader`, always.
    loader: async ({ context }) =>
      await loadAdminIntegrationsRoute(
        routeContext<AdminScreenContext>(context),
      ),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/system/integrations",
    pendingComponent: CardsPendingSkeleton,
    staticData: {
      breadcrumb: adminBreadcrumb({
        segments: ["core", "system", "integrations"],
      }),
    },
  });

  /**
   * The heading's strings come from the loader, so the `<h1>` and the `<title>`
   * are the same string by construction.
   */
  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminIntegrationsRouteContent } =
        await import("../../admin/integrations/screen");

      return {
        default: function AdminIntegrationsRoute() {
          return <AdminIntegrationsRouteContent {...route.useLoaderData()} />;
        },
      };
    }),
  });

  return route;
};

const debugRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

    loaderDeps: ({ search }) => ({
      params: debugLogsRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminDebugRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/debug",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeDebugRouteSearch,
    staticData: { breadcrumb: null },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const { AdminDebugRouteContent } =
        await import("../../admin/debug/screen");

      return {
        default: function AdminDebugRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminDebugRouteContent
              {...route.useLoaderData()}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeDebugRouteSearch>;
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

/** The system section, and the debug panel beside it. */
export const coreSystemRoutes: CoreRouteFactory[] = [
  filesRoute,
  integrationsRoute,
  debugRoute,
];
