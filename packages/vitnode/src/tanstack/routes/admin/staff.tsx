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
import { routeContext, routeSearch } from "../types";

/**
 * `/admin/core/staff/admins` and `/admin/core/staff/moderators` - the AdminCP
 * staff lists.
 *
 * One screen over two API endpoints, so both routes come from one factory with
 * `type` set differently. Everything that could differ between them - the
 * endpoint, the permission module (`staff_admins` / `staff_moderators`) and the
 * strings - is derived from that one value inside `../staff`, and reaches the
 * component through the loader's own data rather than through a second prop.
 *
 * ## Why these are code-based routes rather than files in an application
 *
 * They were `apps/web/src/routes/_admin/admin.core.staff.*.tsx` until this
 * module existed: two files of pure wiring, in every VitNode application,
 * importing every part of the screen from here. Nothing in them was the
 * application's - the loader, the component, the breadcrumb and the search
 * normaliser are all `@vitnode/core`'s - so an app that installed VitNode was
 * made to carry a copy of VitNode's own routing table, and core adding a screen
 * meant an edit in every app that had one.
 *
 * A *plugin* page solves this by declaring itself in a manifest and being
 * imported lazily. These do not, for a reason that belongs to the screens rather
 * than to that layer: `validateSearch` runs during **path matching**, before any
 * chunk is fetched, and these lists keep their whole state in the query string -
 * `?page=999` is clamped and redirected before anything renders. A lazy module
 * is too late to shape a URL.
 *
 * ## What being code-based costs, and what it buys
 *
 * It costs the generated route tree's type table: a `<Link>` to one of these
 * paths carries a plain string rather than a checked route id. That is already
 * true of every plugin route, and it is what the AdminCP does anyway -
 * `RouterLink` takes an `href`, and the sidebar's destinations arrive from
 * `admin-nav.gen.ts` as data.
 *
 * It buys the whole router option set, which is the point: a real
 * `validateSearch`, `loaderDeps`, this route's own `useSearch`/`useNavigate`,
 * and a `staticData.breadcrumb` that is an element rather than something walked
 * out of a module that has not arrived yet.
 */
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
      /**
       * A component rather than `<AdminBreadcrumb segments={...}>`, because two
       * of its crumbs are not in the sidebar under the spellings the page uses:
       * `/admin/core/staff` is a nav *group* with no page of its own.
       */
      staticData: {
        breadcrumb: <AdminStaffBreadcrumbContent type={type} />,
      },
    });

    /**
     * The component is attached afterwards because it reads the route it is
     * part of - `route.useLoaderData()` is how a code-based route reads its own
     * match, exactly as `Route.useLoaderData()` did when this was a file. Inside
     * the `createRoute` call that would be a circular inference; `update` is the
     * router's own way to add options to a route, and is what a file-based route
     * does internally.
     */
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

/**
 * `/admin/core/staff/<type>/create` - adding a role or a user to a staff group.
 *
 * A created entry grants nothing until its permissions are chosen, so a
 * successful create goes to the *edit* screen rather than back to the list -
 * landing on the list would look like the create had silently done nothing.
 * Where that is is `staffEditHref(type, id)`, decided in `../staff`: the package
 * owns VitNode's URL shape, and the route only performs the navigation.
 */
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
      staticData: {
        breadcrumb: <AdminStaffCreateBreadcrumbContent type={type} />,
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

/**
 * `/admin/core/staff/<type>/edit/12` - what one staff entry may do.
 *
 * The public URL is an ordinary one; `$id` is only how a route tree spells "any
 * segment here". `loadAdminStaffEditRoute` turns it into an entry id and answers
 * `notFound()` for anything that is not one, so `.../edit/abc` is a not-found
 * screen rather than a request carrying `NaN`. That normalisation is
 * deliberately not in `params.parse` - see `./users` for why.
 */
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
      staticData: {
        breadcrumb: <AdminStaffEditBreadcrumbContent type={type} />,
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

/**
 * Every staff screen, both groups, in the order the sidebar names them.
 *
 * `$id` rather than `:id`: this is a TanStack route path, not a VitNode manifest
 * path. The manifest's own spelling is a plugin-facing contract; these are
 * router options and use the router's.
 */
export const coreStaffRoutes: CoreRouteFactory[] = (
  ["admin", "moderator"] as const
).flatMap(type => [
  staffListRoute(type, `/admin/core/staff/${type}s`),
  staffCreateRoute(type, `/admin/core/staff/${type}s/create`),
  staffEditRoute(type, `/admin/core/staff/${type}s/edit/$id`),
]);
