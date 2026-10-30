import { buildEventListener } from "@vitnode/core/api/lib/events";

import { buildModule } from "@/api/builders";
import { manifest } from "@/manifest.gen";

import {
  catalogRoute,
  checkoutRoute,
  myPurchasesRoute,
  purchaseRoute,
} from "./purchases.routes";

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
