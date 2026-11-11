/**
 * @deprecated `@vitnode/core/api/modules/notifications/tasks/notification-
 * tasks` was split by the API file migration. This compatibility entry only
 * re-exports its former exports from their new modules, named on each export
 * below; import from those instead.
 */

/** @deprecated Import from `@vitnode/core/api/modules/notifications/cron/notifications.cron`. */
export {
  notificationsCleanupCron,
  notificationsScheduleCron,
} from "@/api/modules/notifications/cron/notifications.cron";
/** @deprecated Import from `@vitnode/core/api/modules/notifications/tasks/notifications.task`. */
export {
  notificationsCleanupTask,
  notificationsEmailTask,
  notificationsFanoutTask,
} from "@/api/modules/notifications/tasks/notifications.task";
