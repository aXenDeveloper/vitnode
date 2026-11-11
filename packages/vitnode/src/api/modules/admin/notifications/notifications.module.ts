import { buildModule } from "@/api/builders";

import { cancelQueuedNotificationEmailsRoute } from "./routes/cancel-queued-emails.route";
import { deleteAllNotificationsRoute } from "./routes/delete-all.route";
import { listNotificationDeliveriesRoute } from "./routes/list-deliveries.route";
import { markEverythingReadRoute } from "./routes/mark-all-read.route";
import { getNotificationsOverviewRoute } from "./routes/overview.route";
import { pauseNotificationsRoute } from "./routes/pause.route";
import { reconcileNotificationCountsRoute } from "./routes/reconcile-counts.route";
import { resetMemberNotificationPreferencesRoute } from "./routes/reset-member-preferences.route";
import { resumeNotificationsRoute } from "./routes/resume.route";
import { retryNotificationDeliveryRoute } from "./routes/retry-delivery.route";
import { sendNotificationTestEmailRoute } from "./routes/send-test-email.route";
import { getNotificationStatsRoute } from "./routes/stats.route";
import { updateNotificationTypePolicyRoute } from "./routes/update-type-policy.route";

export const notificationsAdminModule = buildModule({
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
