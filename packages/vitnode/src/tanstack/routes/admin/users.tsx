import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import { adminBreadcrumb } from "../../admin/breadcrumb";
import { loadAdminRolesRoute } from "../../admin/roles/route";
import {
  normalizeRolesRouteSearch,
  rolesRouteParams,
} from "../../admin/roles/route-search";
import { AdminUserBreadcrumbContent } from "../../admin/users/detail-breadcrumb";
import { loadAdminUserRoute } from "../../admin/users/detail-route";
import { loadAdminUsersRoute } from "../../admin/users/route";
import {
  normalizeUsersRouteSearch,
  usersRouteParams,
} from "../../admin/users/route-search";
import { breadcrumbGroup } from "../../breadcrumb/model";
import { FormPendingSkeleton, TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

const usersListRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,

    loaderDeps: ({ search }) => ({
      params: usersRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminUsersRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/users",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeUsersRouteSearch,
    staticData: {
      breadcrumb: adminBreadcrumb({ segments: ["core", "users"] }),
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ AdminUsersRouteContent }, { RouterLink }] = await Promise.all([
        import("../../admin/users/screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function AdminUsersRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminUsersRouteContent
              {...route.useLoaderData()}
              LinkComponent={RouterLink}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeUsersRouteSearch>;
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

const rolesRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    loaderDeps: ({ search }) => ({
      params: rolesRouteParams(routeSearch(search)),
    }),
    // `head` after `loader`, always.
    loader: async ({ context, deps }) =>
      await loadAdminRolesRoute({
        ...routeContext<AdminScreenContext>(context),
        params: deps.params,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/users/roles",
    pendingComponent: TablePendingSkeleton,
    validateSearch: normalizeRolesRouteSearch,
    staticData: {
      breadcrumb: adminBreadcrumb({ segments: ["core", "users", "roles"] }),
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ AdminRolesRouteContent }, { RouterLink }] = await Promise.all([
        import("../../admin/roles/screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function AdminRolesRoute() {
          const navigate = route.useNavigate();

          return (
            <AdminRolesRouteContent
              {...route.useLoaderData()}
              LinkComponent={RouterLink}
              navigate={useCallback(
                async ({
                  resetScroll,
                  search,
                }: {
                  resetScroll: boolean;
                  search: ReturnType<typeof normalizeRolesRouteSearch>;
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

const userRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    // `head` after `loader`, always.
    loader: async ({ context, params }) =>
      await loadAdminUserRoute({
        ...routeContext<AdminScreenContext>(context),
        id: (params as { id: string }).id,
      }),
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/core/users/$id",
    pendingComponent: FormPendingSkeleton,
    staticData: {
      breadcrumb: breadcrumbGroup(function AdminUserBreadcrumb({ params }) {
        return <AdminUserBreadcrumbContent params={params} />;
      }),
    },
  });

  route.update({
    component: lazyRouteComponent(async () => {
      const [{ AdminUserRouteContent }, { RouterLink }] = await Promise.all([
        import("../../admin/users/detail-screen"),
        import("../../layout/router-link"),
      ]);

      return {
        default: function AdminUserRoute() {
          return (
            <AdminUserRouteContent
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

/** The users section: the list, the roles list beside it, and one user. */
export const coreUsersRoutes: CoreRouteFactory[] = [
  usersListRoute,
  rolesRoute,
  userRoute,
];
