import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "@vitnode/core/routing";

import { browseSearch } from "./pages/browse-search";

export const routes = definePluginRoutes([
  page("/example", {
    component: lazy(() => import("./pages/example-page")),
  }),

  page("/example/browse", {
    component: lazy(() => import("./pages/browse-page")),
    messages: ["@vitnode/example.browse"],
    search: browseSearch,
  }),

  layout("/example/guide", {
    component: lazy(() => import("./pages/guide-layout")),
    messages: ["@vitnode/example.guide"],
    children: [
      /** The page at the layout's own URL - `/example/guide`. */
      index({
        component: lazy(() => import("./pages/guide-index-page")),
      }),

      page(":topic", {
        component: lazy(() => import("./pages/guide-topic-page")),
      }),
    ],
  }),

  page("/admin/example", {
    area: "admin",
    component: lazy(() => import("./pages/admin-example-page")),
    messages: ["@vitnode/example.admin.overview"],
  }),
]);
