import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";
import { CardsPendingSkeleton } from "@vitnode/core/tanstack/pending";

import { blogListSearch } from "./pages/blog-list";

/**
 * The blog's public pages: the `/blog` index and `/blog/:slug`, which serves
 * the article's `search.pathTemplate` (`/blog/{slug}`); the web build fails if
 * that URL has no matching page.
 */
export const routes = definePluginRoutes([
  page("/blog", {
    // Only a URL without a query string is ever stored, so `?q=`, `?category=`,
    // `?sort=` and `?page=` always render fresh, and each locale is its own
    // URL. Publishing, editing, hiding or deleting an article - or changing a
    // category - expires the stored page through the Content Engine's tags.
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/blog-page")),
    messages: ["@vitnode/blog.list"],
    pendingComponent: CardsPendingSkeleton,
    search: blogListSearch,
  }),

  page("/blog/:slug", {
    // Published articles read the same for everybody, so their HTML is reused
    // for five minutes, plus one more minute while a fresh render runs. Edits,
    // unpublishing and hiding invalidate it through the Content Engine.
    cache: { maxAge: 300, staleWhileRevalidate: 60 },
    component: lazy(() => import("./pages/post-page")),
    messages: ["@vitnode/blog.post"],
  }),
]);
