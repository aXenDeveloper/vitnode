import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

export const routes = definePluginRoutes([
  page("/blog/:slug", {
    component: lazy(() => import("./pages/post-page")),
    messages: ["@vitnode/blog.post"],
  }),
]);
