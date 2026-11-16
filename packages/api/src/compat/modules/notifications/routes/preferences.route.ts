/**
 * @deprecated
 * `@vitnode/api/modules/notifications/routes/preferences.route` was
 * split by the API file migration. This compatibility entry only re-exports
 * its former exports from their new modules, named on each export below;
 * import from those instead.
 */

/** @deprecated Import from `@vitnode/api/modules/notifications/notifications.schema`. */
export {
  zodNotificationPreferences,
  zodUpdateNotificationPreferences,
} from "@/modules/notifications/notifications.schema";
/** @deprecated Import from `@vitnode/api/modules/notifications/routes/show-preferences.route`. */
export { getNotificationPreferencesRoute } from "@/modules/notifications/routes/show-preferences.route";
/** @deprecated Import from `@vitnode/api/modules/notifications/routes/update-preferences.route`. */
export { updateNotificationPreferencesRoute } from "@/modules/notifications/routes/update-preferences.route";
