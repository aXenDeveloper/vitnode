/**
 * `/admin/core` - the AdminCP dashboard, for a TanStack Start host.
 *
 *     ./query    the layout query, and the four actions the board performs
 *     ./route    the screen: namespaces, loader, component
 *     ./server   the SSR transport, reached only through `./query`
 *     ./widgets  core's widgets as a *browser* can render them
 *
 * The board itself - the grid, the drag-and-drop, the widget panel, the settings
 * dialog - is framework-free and imported from
 * `@/views/admin/views/core/dashboard` by both applications. What differs is one
 * object: `DashboardActions`, whose Next.js half is `DashboardBoardProviderNext`
 * and whose TanStack half is `useDashboardActions`.
 */
export {
  dashboardLayoutQuery,
  invalidateDashboardLayout,
  useDashboardActions,
} from "./query";
export type { AdminDashboardRouteData } from "./route";
export { ADMIN_DASHBOARD_NAMESPACES, loadAdminDashboardRoute } from "./route";
export type {
  AdminDashboardRouteProps,
  DashboardPluginWidgets,
} from "./screen";
export { AdminDashboardRouteContent } from "./screen";
export { coreDashboardBrowserWidgets } from "./widgets";

export type {
  DashboardActions,
  DashboardMutationResult,
} from "@/views/admin/views/core/dashboard/widgets/dashboard-actions";
export type { DashboardStoredLayout } from "@/views/admin/views/core/dashboard/widgets/layout-query";
export { dashboardLayoutQueryKey } from "@/views/admin/views/core/dashboard/widgets/layout-query";
