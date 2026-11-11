import { paymentSucceededEvent } from "@vitnode/core/api/events/payments";
import { buildEventListener } from "@vitnode/core/api/lib/events";

import { buildModule } from "@/api/builders";
import { manifest } from "@/manifest.gen";

import { checkoutRoute } from "./routes/checkout.route";
import { myPurchasesRoute } from "./routes/list-purchases.route";
import { catalogRoute } from "./routes/show-catalog.route";
import { purchaseRoute } from "./routes/show-purchase.route";

const logPaidPurchase = buildEventListener({
  event: paymentSucceededEvent,
  name: "log-paid-purchase",
  handler: async (c, payload) => {
    if (payload.pluginId !== manifest.id) return;

    await c
      .get("log")
      .debug(
        `[payments-demo] ${payload.reference} paid (${payload.paymentId}).`,
      );
  },
});

export const purchasesModule = buildModule({
  name: "purchases",
  routes: [catalogRoute, myPurchasesRoute, checkoutRoute, purchaseRoute],
  events: [logPaidPurchase],
});
