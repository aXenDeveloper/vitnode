import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

export const routes = definePluginRoutes([
  page("/blog/:slug", {
    // Published articles read the same for everybody, so their HTML is reused
    // for five minutes, plus one more minute while a fresh render runs. Edits,
    // unpublishing and hiding invalidate it through the Content Engine.
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/post-page")),
    messages: ["@vitnode/blog.post"],
  }),
]);
