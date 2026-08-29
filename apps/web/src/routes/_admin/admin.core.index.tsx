import { createFileRoute } from '@tanstack/react-router'
import { AdminBreadcrumb } from '@vitnode/core/tanstack/admin'
import {
  AdminDashboardRouteContent,
  loadAdminDashboardRoute,
} from '@vitnode/core/tanstack/admin/dashboard'

/**
 * `/admin/core` - the AdminCP dashboard.
 *
 * Topology only. The layout query, the widget catalogue, the drag-and-drop
 * board, the settings dialogs and the four mutations behind them are
 * `@vitnode/core/tanstack/admin/dashboard`; the Next.js route at
 * `packages/vitnode/src/routes/admin/core/page.tsx` is still live and renders
 * the same `DashboardBoardProvider` over the same stored layout.
 *
 * ## It is also what turns the shell on
 *
 * A pathless layout route with no children is unreachable. `_admin` contributes
 * no URL segment, so with nothing under it `isTanStackOwnedPath('/admin/core')`
 * would answer `false` and `AdminShellContent` would never render at all. This
 * was the first child, and the rest of Wave 1 joined it.
 *
 * ## No `head`, deliberately
 *
 * The Next.js page exports no `generateMetadata`, so the tab keeps the site's
 * own name. Declaring `title: 'VitNode'` here would render "VitNode - VitNode"
 * through `formatPageTitle`; saying nothing inherits the root's title and
 * `_admin`'s `noindex`, which is the parity-preserving answer.
 *
 * ## `pluginWidgets` is not passed
 *
 * A plugin's dashboard widgets reach the Next.js board through
 * `getVitNodeConfig()`, which is server-side config kept out of this app's
 * browser bundle by `vitnode.shell.config.ts` - and this app registers its
 * plugins by id and messages only (see `src/vitnode.config.ts`). So the board
 * shows core's own widgets, which is the complete set for this install. It is
 * the same seam `AdminShell` leaves open for nav `declarations`, and it changes
 * here when plugin AdminCP registration moves over.
 */
export const Route = createFileRoute('/_admin/admin/core/')({
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
    breadcrumb: <AdminBreadcrumb segments={['core']} />,
  },
})

function AdminDashboardRoute() {
  return <AdminDashboardRouteContent {...Route.useLoaderData()} />
}
