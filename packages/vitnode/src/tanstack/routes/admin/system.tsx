import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import { AdminBreadcrumb } from "../../admin/breadcrumb";
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

/**
 * `/admin/core/system/files` - every file uploaded to the installation.
 *
 * The query, the three permissions (`files.can_view` to open it,
 * `files.can_download` and `files.can_delete` for the row controls), the
 * namespaces, the title, the search box and both deletes are `../files`.
 *
 * Not to be confused with `/files` under `_main/_authenticated`, which is the
 * *visitor's own* files: a different endpoint, a different permission and a
 * different cache family. That one is genuinely the application's page and stays
 * a route file in it.
 */
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
      breadcrumb: <AdminBreadcrumb segments={["core", "system", "files"]} />,
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

/**
 * `/admin/core/system/integrations` - the integrations board.
 *
 * The least of it: this screen has no search parameters, so there is no
 * `validateSearch` and no `loaderDeps` - the loader runs once per navigation.
 * The query, the permission (`system.can_view`, plus `system.can_test_ai` /
 * `can_test_storage` / `can_send_test_email` for the three test buttons), the
 * namespaces, the title and the nine cards are `../integrations`.
 */
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
      breadcrumb: (
        <AdminBreadcrumb segments={["core", "system", "integrations"]} />
      ),
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

/**
 * `/admin/core/debug` - the debug panel: the queue snapshot, the system log, and
 * "clear the cache".
 *
 * The queries, the permission (`debug.can_view` to open it,
 * `debug.can_clear_cache` for the button), the namespaces, the titles and all
 * three sections are `../debug`.
 *
 * No `LinkComponent`: the log's detail dialog links a line to the user who
 * caused it, at `/admin/core/users/{id}`, and the screen's default -
 * `RouterLink` - is exactly right for a route in this tree.
 *
 * ## No breadcrumb, deliberately
 *
 * `staticData.breadcrumb: null` rather than nothing at all, because `undefined`
 * would *inherit* a parent's crumb rather than mean "this page has none".
 * Giving the panel a trail is a product decision.
 */
const debugRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The system log's parameters. It is the only thing on the screen with URL
     * state - the queue snapshot has no pager and the clear-cache button writes
     * nothing - so the screen's search is the log table's.
     */
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
