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
