import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { listWebhookEventsAdminRoute } from "./routes/events.route";
import { paymentsOverviewAdminRoute } from "./routes/overview.route";
import {
  listPurchasesAdminRoute,
  showPurchaseAdminRoute,
} from "./routes/purchases.route";
import {
  retryFulfillmentAdminRoute,
  retryWebhookEventAdminRoute,
} from "./routes/retry.route";
import { listSubscriptionsAdminRoute } from "./routes/subscriptions.route";

export const paymentsAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "payments",
  routes: [
    paymentsOverviewAdminRoute,
    listPurchasesAdminRoute,
    showPurchaseAdminRoute,
    listSubscriptionsAdminRoute,
    listWebhookEventsAdminRoute,
    retryFulfillmentAdminRoute,
    retryWebhookEventAdminRoute,
  ],
});
