import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

export const routes = definePluginRoutes([
  page("/payments-demo", {
    component: lazy(() => import("./pages/shop-page")),
    messages: ["payments-demo"],
  }),

  // The success and cancel destination of the checkout. It shows the
  // server's status, never the fact that the browser came back.
  page("/payments-demo/purchases/:purchaseId", {
    component: lazy(() => import("./pages/purchase-page")),
    messages: ["payments-demo"],
    requires: "authenticated",
  }),
]);
