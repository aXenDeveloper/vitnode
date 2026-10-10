import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";
import { contentListSearch } from "@vitnode/core/tanstack/content";

import { blogPostContentType } from "./content/post";

export const routes = definePluginRoutes([
  page("/blog", {
    component: lazy(() => import("./pages/posts-page")),
    messages: ["@vitnode/blog.list"],
    search: contentListSearch(blogPostContentType),
  }),
  page("/blog/:slug", {
    component: lazy(() => import("./pages/post-page")),
    messages: ["@vitnode/blog.post"],
  }),
]);
