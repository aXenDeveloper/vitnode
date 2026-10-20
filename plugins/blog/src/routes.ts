import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

import { blogCategoryListSearch, blogListSearch } from "./pages/blog-list";
import {
  BlogCategoryPendingSkeleton,
  BlogPendingSkeleton,
} from "./pages/blog-skeleton";

/**
 * The blog's public pages: the `/blog` index, one page per category at
 * `/blog/category/:slug`, and `/blog/article/:slug`, which serves the article's
 * `delivery.path` and `search.pathTemplate` (`/blog/article/{slug}`); the web
 * build fails if that URL has no matching page. `/blog/:slug` only redirects
 * links from before articles moved under `/blog/article`.
 */
export const routes = definePluginRoutes([
  page("/blog", {
    // Only a URL without a query string is ever stored, so `?page=` always
    // renders fresh, and each locale is its own URL. Publishing, editing,
    // hiding or deleting an article - or changing a category - expires the
    // stored page through the Content Engine's tags.
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/blog-page")),
    messages: ["@vitnode/blog.list"],
    pendingComponent: BlogPendingSkeleton,
    search: blogListSearch,
  }),

  page("/blog/category/:slug", {
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/blog-category-page")),
    messages: ["@vitnode/blog.list"],
    pendingComponent: BlogCategoryPendingSkeleton,
    search: blogCategoryListSearch,
  }),

  page("/blog/article/:slug", {
    // Published articles read the same for everybody, so their HTML is reused
    // for five minutes, plus one more minute while a fresh render runs. Edits,
    // unpublishing and hiding invalidate it through the Content Engine.
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/post-page")),
    messages: ["@vitnode/blog.post"],
  }),

  page("/blog/:slug", {
    component: lazy(() => import("./pages/legacy-post-redirect-page")),
  }),
]);
