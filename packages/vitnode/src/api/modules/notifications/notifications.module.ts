import { buildModule } from "@/api/builders";
import { coreNotificationTypes } from "@/api/lib/notifications/core-types";

import {
  notificationsCleanupCron,
  notificationsScheduleCron,
} from "./cron/notifications.cron";
import { archiveNotificationRoute } from "./routes/archive.route";
import { listNotificationsRoute } from "./routes/list.route";
import { markAllNotificationsReadRoute } from "./routes/mark-all-read.route";
import { markNotificationReadRoute } from "./routes/mark-read.route";
import { markNotificationUnreadRoute } from "./routes/mark-unread.route";
import { getNotificationPreferencesRoute } from "./routes/show-preferences.route";
import { notificationStateRoute } from "./routes/state.route";
import { updateNotificationPreferencesRoute } from "./routes/update-preferences.route";
import {
  notificationsCleanupTask,
  notificationsEmailTask,
  notificationsFanoutTask,
} from "./tasks/notifications.task";

export const notificationsModule = buildModule({
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
  ],
  cronJobs: [notificationsScheduleCron, notificationsCleanupCron],
  queueTasks: [
    notificationsFanoutTask,
    notificationsEmailTask,
    notificationsCleanupTask,
  ],
  notificationTypes: coreNotificationTypes,
});
