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

/**
 * `/admin/core/users` - the AdminCP users list.
 *
 * The query, the permissions (`users.can_view` to open it, `users.can_create`
 * for the button, `users.can_edit` for the rows), the namespaces, the title, the
 * table and the role filter's lookup are all `../users`. What is here is
 * topology and the three things only a router can give a route: the search
 * contract, `navigate`, and the crumb.
 *
 * `RouterLink` is passed rather than defaulted because the screen takes the link
 * as a required prop - a row's pencil points at `/admin/core/users/123`, and the
 * shared table below it is host-neutral and may not import a router itself.
 *
 * No locale prefix, in any language: `DEFAULT_IGNORED_LOCALE_PATHS` lists
 * `/admin` with its descendants, so the rewrite neither strips one nor writes
 * one. `robots` is the AdminCP shell's.
 */
const usersListRoute: CoreRouteFactory = ({ pageHead, parentRoute }) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    /**
     * The request, as the only thing the loader re-runs for.
     *
     * The *normalised* parameters rather than the raw search: the router hands
     * `loaderDeps` the validated search merged over everything else that was in
     * the query string, so keying on it directly would re-run the loader for a
     * stray `?utm_source=` - and would treat `?first=10` and no `first` as two
     * different pages of the same rows.
     */
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

/**
 * `/admin/core/users/roles` - the AdminCP roles list.
 *
 * A sibling of `users/$id` rather than a child of it: `roles` is a static
 * segment and TanStack ranks those above dynamic ones, so `/admin/core/users/roles`
 * matches this route and never `$id`. `admin-routes.test.ts` pins it against the
 * real tree, which is what makes the ranking a checked fact rather than a
 * remembered one.
 *
 * The query, the six permissions the row actions apply, the namespaces, the
 * title, the table and both dialogs are `../roles`.
 */
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

  /**
   * The members count links to `/admin/core/users?roleId=<id>`, whose query
   * string has to survive the hop - `RouterLink` hands the whole href to the
   * router, so it does.
   */
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

/**
 * `/admin/core/users/123` - one user.
 *
 * The public URL is an ordinary one: a number in the path, no prefix, nothing
 * encoded. `$id` is only how a route tree spells "any segment here", and the
 * segment is turned into an id by `loadAdminUserRoute` - which answers
 * `notFound()` for anything that is not a decimal id, so `/admin/core/users/abc`
 * is a not-found screen rather than a request carrying `NaN`.
 *
 * That normalisation is deliberately *not* in `params.parse`. `parse` runs
 * inside `matchRoutes`, which the router calls on every navigation and every
 * `<Link>` it builds - so a `parse` that threw would take down far more than the
 * one screen with a bad id in its URL.
 */
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

  /**
   * The screen takes the link as a required prop - it links out to
   * `/profile/<nameCode>` - and the shared views below it may not import a
   * router themselves, so core's own `RouterLink` is supplied here.
   */
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
