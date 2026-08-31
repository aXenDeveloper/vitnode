import { createFileRoute } from "@tanstack/react-router";
import { AdminBreadcrumb } from "@vitnode/core/tanstack/admin";
import {
  AdminDashboardRouteContent,
  loadAdminDashboardRoute,
} from "@vitnode/core/tanstack/admin/dashboard";

/**
 * `/admin/core` - the AdminCP dashboard, and the one route file `_admin` keeps.
 *
 * Topology only. The layout query, the widget catalogue, the drag-and-drop
 * board, the settings dialogs and the four mutations behind them are
 * `@vitnode/core/tanstack/admin/dashboard`.
 *
 * ## Why this one file is still here
 *
 * Every other AdminCP screen is `@vitnode/core`'s, mounted by
 * `withCoreAdminRoutes` as a code-based route - see `src/router.tsx`. This one
 * stays because the file-based generator requires it to, and the requirement is
 * sharp rather than stylistic:
 *
 * - A pathless layout with no file children is **dropped from the generated
 *   tree**. `buildRouteTreeConfig` skips it outright, so `_admin` would not be
 *   in `routeTree.gen.ts` at all and the route object `src/router.tsx` mounts
 *   core's screens under would be an orphan.
 * - It also collapses to a full path of `/`, which collides with `_main/index.tsx`
 *   and fails the generator's uniqueness check by name.
 *
 * So `_admin` needs one file-based child with a real path in order to exist, and
 * this is it - which is the same job it has always had. It was the shell's first
 * child for exactly this reason, and now it is the only one.
 *
 * Deleting it does not remove a screen; it removes the AdminCP.
 *
 * ## No `head`, deliberately
 *
 * The dashboard is the site under its own name, so the tab keeps that name.
 * Declaring `title: 'VitNode'` here would render "VitNode - VitNode" through
 * `formatPageTitle`; saying nothing inherits the root's title and `_admin`'s
 * `noindex`, which is what this screen wants.
 *
 * ## `pluginWidgets` is not passed
 *
 * A plugin's dashboard widgets live in its server-side config, which
 * `vitnode.shell.config.ts` deliberately keeps out of this app's browser bundle -
 * and this app registers its plugins by id and messages only (see
 * `src/vitnode.config.ts`). So the board shows core's own widgets, which is the
 * complete set for this install. It is the same seam `AdminShell` leaves open for
 * nav `declarations`: pass `pluginWidgets` here when you have some.
 */
export const Route = createFileRoute("/_admin/admin/core/")({
  loader: async ({ context }) => await loadAdminDashboardRoute(context),
  component: AdminDashboardRoute,
  /**
   * The whole of how an admin route contributes to the trail in the shell's
   * header: the route declares its own crumb next to its own component, the
   * shell renders whichever matched route declared the deepest one, and there is
   * no map from pathname to breadcrumb anywhere. The label comes from the
   * *visible* navigation, so this reads "Core" in whatever language the
   * administrator is using without this file naming a string.
   */
  staticData: {
    breadcrumb: <AdminBreadcrumb segments={["core"]} />,
  },
});

function AdminDashboardRoute() {
  return <AdminDashboardRouteContent {...Route.useLoaderData()} />;
}
