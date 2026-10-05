export {
  invalidateNotificationsAdmin,
  useNotificationsAdminActions,
} from "./query";
export type { AdminNotificationsRouteData } from "./route";
export {
  ADMIN_NOTIFICATIONS_NAMESPACES,
  loadAdminNotificationsRoute,
} from "./route";
export { AdminNotificationsRouteContent } from "./screen";

export type {
  NotificationsAdminActions,
  NotificationTypePolicyPatch,
} from "@/views/admin/views/core/system/notifications/notifications-mutations";
export type {
  AdminNotificationsOverview,
  AdminNotificationStats,
  AdminNotificationType,
} from "@/views/admin/views/core/system/notifications/notifications-query";
export {
  notificationsAdminQueryRoot,
  notificationsOverviewQueryOptions,
  notificationStatsQueryOptions,
} from "@/views/admin/views/core/system/notifications/notifications-query";
