import {
  createRoute,
  lazyRouteComponent,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin/screen";
import type { CoreRouteFactory } from "../types";

import {
  AdminStaffBreadcrumbContent,
  AdminStaffCreateBreadcrumbContent,
  AdminStaffEditBreadcrumbContent,
} from "../../admin/staff/breadcrumbs";
import { loadAdminStaffCreateRoute } from "../../admin/staff/create-route";
import { loadAdminStaffEditRoute } from "../../admin/staff/edit-route";
import { loadAdminStaffRoute } from "../../admin/staff/route";
import {
  normalizeStaffRouteSearch,
  staffRouteParams,
} from "../../admin/staff/route-search";
import { breadcrumbGroup } from "../../breadcrumb/model";
import { FormPendingSkeleton, TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

const staffListRoute =
  (type: "admin" | "moderator", path: string): CoreRouteFactory =>
  ({ pageHead, parentRoute }) => {
    const route = createRoute({
      getParentRoute: () => parentRoute,
      loaderDeps: ({ search }) => ({
        params: staffRouteParams(routeSearch(search)),
      }),
      // `head` after `loader`, always: `loaderData` is inferred from `loader`,
      // and TypeScript reads an object literal's members in order.
      loader: async ({ context, deps }) =>
        await loadAdminStaffRoute({
          ...routeContext<AdminScreenContext>(context),
          params: deps.params,
          type,
        }),
      head: ({ loaderData }) => pageHead({ ...loaderData }),
      path,
      validateSearch: normalizeStaffRouteSearch,
      pendingComponent: TablePendingSkeleton,

      staticData: {
        breadcrumb: breadcrumbGroup(function StaffBreadcrumb() {
          return <AdminStaffBreadcrumbContent type={type} />;
        }),
      },
    });

    route.update({
      component: lazyRouteComponent(async () => {
        const [{ AdminStaffRouteContent }, { RouterLink }] = await Promise.all([
          import("../../admin/staff/screen"),
          import("../../layout/router-link"),
        ]);

        return {
          default: function AdminStaffRoute() {
            const navigate = route.useNavigate();

            return (
              <AdminStaffRouteContent
                {...route.useLoaderData()}
                LinkComponent={RouterLink}
                // Narrowed to the two fields the table asks for, and memoised so the
                // screen's own `useMemo` over it keeps holding.
                navigate={useCallback(
                  async ({
                    resetScroll,
                    search,
                  }: {
                    resetScroll: boolean;
                    search: ReturnType<typeof normalizeStaffRouteSearch>;
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

const staffCreateRoute =
  (type: "admin" | "moderator", path: string): CoreRouteFactory =>
  ({ pageHead, parentRoute }) => {
    const route = createRoute({
      getParentRoute: () => parentRoute,
      // `head` after `loader`, always.
      loader: async ({ context }) =>
        await loadAdminStaffCreateRoute({
          ...routeContext<AdminScreenContext>(context),
          type,
        }),
      head: ({ loaderData }) => pageHead({ ...loaderData }),
      path,
      pendingComponent: FormPendingSkeleton,
      staticData: {
        breadcrumb: breadcrumbGroup(function StaffCreateBreadcrumb() {
          return <AdminStaffCreateBreadcrumbContent type={type} />;
        }),
      },
    });

    route.update({
      component: lazyRouteComponent(async () => {
        const [{ AdminStaffCreateRouteContent }, { RouterLink }] =
          await Promise.all([
            import("../../admin/staff/create-screen"),
            import("../../layout/router-link"),
          ]);

        return {
          default: function AdminStaffCreateRoute() {
            const router = useRouter();

            return (
              <AdminStaffCreateRouteContent
                {...route.useLoaderData()}
                LinkComponent={RouterLink}
                navigate={useCallback(
                  async (href: string) => {
                    await router.navigate({ to: href });
                  },
                  [router],
                )}
              />
            );
          },
        };
      }),
    });

    return route;
  };

const staffEditRoute =
  (type: "admin" | "moderator", path: string): CoreRouteFactory =>
  ({ pageHead, parentRoute }) => {
    const route = createRoute({
      getParentRoute: () => parentRoute,
      // `head` after `loader`, always.
      loader: async ({ context, params }) =>
        await loadAdminStaffEditRoute({
          ...routeContext<AdminScreenContext>(context),
          id: (params as { id: string }).id,
          type,
        }),
      head: ({ loaderData }) => pageHead({ ...loaderData }),
      path,
      pendingComponent: FormPendingSkeleton,
      staticData: {
        breadcrumb: breadcrumbGroup(function StaffEditBreadcrumb() {
          return <AdminStaffEditBreadcrumbContent type={type} />;
        }),
      },
    });

    route.update({
      component: lazyRouteComponent(async () => {
        const [{ AdminStaffEditRouteContent }, { RouterLink }] =
          await Promise.all([
            import("../../admin/staff/edit-screen"),
            import("../../layout/router-link"),
          ]);

        return {
          default: function AdminStaffEditRoute() {
            const router = useRouter();

            return (
              <AdminStaffEditRouteContent
                {...route.useLoaderData()}
                LinkComponent={RouterLink}
                navigate={useCallback(
                  async (href: string) => {
                    await router.navigate({ to: href });
                  },
                  [router],
                )}
              />
            );
          },
        };
      }),
    });

    return route;
  };

export const coreStaffRoutes: CoreRouteFactory[] = (
  ["admin", "moderator"] as const
).flatMap(type => [
  staffListRoute(type, `/admin/core/staff/${type}s`),
  staffCreateRoute(type, `/admin/core/staff/${type}s/create`),
  staffEditRoute(type, `/admin/core/staff/${type}s/edit/$id`),
]);
