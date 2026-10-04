import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import {
  listNotificationDeliveriesRoute,
  retryNotificationDeliveryRoute,
} from "./routes/deliveries.route";
import {
  reconcileNotificationCountsRoute,
  runNotificationCleanupRoute,
  sendNotificationTestEmailRoute,
} from "./routes/maintenance.route";
import { getNotificationsOverviewRoute } from "./routes/overview.route";
import {
  updateNotificationSettingsRoute,
  updateNotificationTypePolicyRoute,
} from "./routes/settings.route";

export const notificationsAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "notifications",
  routes: [
    getNotificationsOverviewRoute,
    updateNotificationSettingsRoute,
    updateNotificationTypePolicyRoute,
    listNotificationDeliveriesRoute,
    retryNotificationDeliveryRoute,
    sendNotificationTestEmailRoute,
    reconcileNotificationCountsRoute,
    runNotificationCleanupRoute,
  ],
});
