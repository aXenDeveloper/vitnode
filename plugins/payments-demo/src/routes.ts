import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

export const routes = definePluginRoutes([
  page("/payments-demo", {
    component: lazy(() => import("./pages/shop-page")),
    messages: ["payments-demo"],
  }),

  page("/payments-demo/purchases/:purchaseId", {
    component: lazy(() => import("./pages/purchase-page")),
    messages: ["payments-demo"],
    requires: "authenticated",
  }),
]);
