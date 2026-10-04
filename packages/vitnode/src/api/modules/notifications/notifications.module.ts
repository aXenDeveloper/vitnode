import { buildModule } from "@/api/lib/module";
import { coreNotificationTypes } from "@/api/lib/notifications/core-types";
import { CONFIG_PLUGIN } from "@/config";

import { listNotificationsRoute } from "./routes/list.route";
import {
  archiveNotificationRoute,
  markAllNotificationsReadRoute,
  markNotificationReadRoute,
  markNotificationUnreadRoute,
} from "./routes/mark.route";
import {
  getNotificationPreferencesRoute,
  updateNotificationPreferencesRoute,
} from "./routes/preferences.route";
import { notificationStateRoute } from "./routes/state.route";
import {
  getSubscriptionRoute,
  listSubscriptionsRoute,
  setSubscriptionRoute,
} from "./routes/subscriptions.route";
import {
  notificationsCleanupCron,
  notificationsCleanupTask,
  notificationsEmailTask,
  notificationsFanoutTask,
  notificationsScheduleCron,
} from "./tasks/notification-tasks";

export const notificationsModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "notifications",
  routes: [
    listNotificationsRoute,
    notificationStateRoute,
    markAllNotificationsReadRoute,
    markNotificationReadRoute,
    markNotificationUnreadRoute,
    archiveNotificationRoute,
    getNotificationPreferencesRoute,
    updateNotificationPreferencesRoute,
    listSubscriptionsRoute,
    getSubscriptionRoute,
    setSubscriptionRoute,
  ],
  cronJobs: [notificationsScheduleCron, notificationsCleanupCron],
  queueTasks: [
    notificationsFanoutTask,
    notificationsEmailTask,
    notificationsCleanupTask,
  ],
  notificationTypes: coreNotificationTypes,
});
