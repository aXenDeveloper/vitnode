import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import {
  cancelQueuedNotificationEmailsRoute,
  deleteAllNotificationsRoute,
  markEverythingReadRoute,
  pauseNotificationsRoute,
  resetMemberNotificationPreferencesRoute,
  resumeNotificationsRoute,
} from "./routes/danger.route";
import {
  listNotificationDeliveriesRoute,
  retryNotificationDeliveryRoute,
} from "./routes/deliveries.route";
import {
  reconcileNotificationCountsRoute,
  sendNotificationTestEmailRoute,
} from "./routes/maintenance.route";
import { getNotificationsOverviewRoute } from "./routes/overview.route";
import { updateNotificationTypePolicyRoute } from "./routes/settings.route";
import { getNotificationStatsRoute } from "./routes/stats.route";

export const notificationsAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "notifications",
  routes: [
    getNotificationsOverviewRoute,
    updateNotificationTypePolicyRoute,
    listNotificationDeliveriesRoute,
    retryNotificationDeliveryRoute,
    sendNotificationTestEmailRoute,
    reconcileNotificationCountsRoute,
    getNotificationStatsRoute,
    pauseNotificationsRoute,
    resumeNotificationsRoute,
    cancelQueuedNotificationEmailsRoute,
    markEverythingReadRoute,
    deleteAllNotificationsRoute,
    resetMemberNotificationPreferencesRoute,
  ],
});
