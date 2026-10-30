import { buildModule } from "@/api/builders";

import { reconcilePaymentsCron } from "./cron/reconcile.cron";
import { paymentWebhookRoute } from "./routes/webhook.route";

export const paymentsModule = buildModule({
  name: "payments",
  routes: [paymentWebhookRoute],
  cronJobs: [reconcilePaymentsCron],
});
