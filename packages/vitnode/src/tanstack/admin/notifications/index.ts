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
  AdminNotificationDeliveriesPage,
  AdminNotificationDelivery,
  AdminNotificationsOverview,
  AdminNotificationType,
} from "@/views/admin/views/core/system/notifications/notifications-query";
export {
  notificationDeliveriesQueryOptions,
  notificationsAdminQueryRoot,
  notificationsOverviewQueryOptions,
} from "@/views/admin/views/core/system/notifications/notifications-query";
