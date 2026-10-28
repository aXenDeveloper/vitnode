import { buildEventListener } from "@vitnode/core/api/lib/events";

import { buildModule } from "@/api/builders";
import { manifest } from "@/manifest.gen";

import {
  catalogRoute,
  checkoutRoute,
  myPurchasesRoute,
  purchaseRoute,
} from "./purchases.routes";

// A side effect only. What a member owns is read from the stored payment,
// never from this event: the default events adapter runs listeners in the
// webhook request and does not retry them.
const logPaidPurchase = buildEventListener({
  event: "payment.succeeded",
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
