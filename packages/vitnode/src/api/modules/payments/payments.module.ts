import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { checkoutRoute } from "./routes/checkout.route";
import { paymentOffersRoute } from "./routes/offers.route";
import { portalRoute } from "./routes/portal.route";
import {
  cancelPurchaseRoute,
  listPurchasesRoute,
  showPurchaseRoute,
} from "./routes/purchases.route";
import { paymentsSettingsRoute } from "./routes/settings.route";
import { listSubscriptionsRoute } from "./routes/subscriptions.route";
import { webhookRoute } from "./routes/webhook.route";
import {
  fulfillPaymentTask,
  processPaymentEventTask,
  reconcilePaymentsCron,
} from "./tasks/payments.tasks";

export const paymentsModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "payments",
  routes: [
    paymentsSettingsRoute,
    paymentOffersRoute,
    checkoutRoute,
    listPurchasesRoute,
    showPurchaseRoute,
    cancelPurchaseRoute,
    listSubscriptionsRoute,
    portalRoute,
    webhookRoute,
  ],
  cronJobs: [reconcilePaymentsCron],
  queueTasks: [processPaymentEventTask, fulfillPaymentTask],
});
