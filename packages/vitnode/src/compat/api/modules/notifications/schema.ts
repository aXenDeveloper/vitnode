/**
 * @deprecated `@vitnode/core/api/modules/notifications/schema` was split by
 * the API file migration. This compatibility entry only re-exports its
 * former exports from their new modules, named on each export below; import
 * from those instead.
 */

/** @deprecated Import from `@vitnode/core/api/modules/notifications/lib/require-notification-user`. */
export { requireNotificationUser } from "@/api/modules/notifications/lib/require-notification-user";
/** @deprecated Import from `@vitnode/core/api/modules/notifications/notifications.schema`. */
export {
  unauthorizedResponse,
  zodNotificationEmailMode,
  zodNotificationIdParams,
  zodNotificationItem,
  zodNotificationState,
} from "@/api/modules/notifications/notifications.schema";
