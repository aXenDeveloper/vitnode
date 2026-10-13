import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";
import {
  FeedPendingSkeleton,
  FormPendingSkeleton,
  RoutePendingSkeleton,
} from "@vitnode/core/tanstack/pending";

import {
  forumSearch,
  pendingSearch,
  topicEditSearch,
  topicNewSearch,
  topicSearch,
} from "./pages/forum-links";

/**
 * Public reads render the same for everybody - anything that depends on who is
 * looking (edit links, composers) loads in the browser - so their HTML is
 * reused briefly. Every write invalidates it through the Content Engine.
 */
const PUBLIC_CACHE = { maxAge: 60, staleWhileRevalidate: 30 };

// Static pages sit two segments deep under segments no slug can take
// (`create`, `me`), so a forum called "Pending" or a topic called "New" keeps
// its own address.
export const routes = definePluginRoutes([
  page("/forum", {
    cache: PUBLIC_CACHE,
    component: lazy(() => import("./pages/forums-page")),
    messages: ["@vitnode/forum.forums"],
    pendingComponent: RoutePendingSkeleton,
  }),

  page("/forum/me/pending", {
    component: lazy(() => import("./pages/pending-page")),
    messages: ["@vitnode/forum.forums", "@vitnode/forum.pending"],
    pendingComponent: FeedPendingSkeleton,
    requires: "authenticated",
    search: pendingSearch,
  }),

  page("/forum/:slug", {
    cache: PUBLIC_CACHE,
    component: lazy(() => import("./pages/forum-page")),
    messages: ["@vitnode/forum.forums"],
    pendingComponent: FeedPendingSkeleton,
    search: forumSearch,
  }),

  page("/forum/create/topic", {
    component: lazy(() => import("./pages/topic-new-page")),
    messages: ["@vitnode/forum.forums", "@vitnode/forum.topics"],
    pendingComponent: FormPendingSkeleton,
    requires: "authenticated",
    search: topicNewSearch,
  }),

  page("/forum/topics/:id/edit", {
    component: lazy(() => import("./pages/topic-edit-page")),
    messages: ["@vitnode/forum.forums", "@vitnode/forum.topics"],
    pendingComponent: FormPendingSkeleton,
    search: topicEditSearch,
  }),

  page("/forum/topics/:slug", {
    cache: PUBLIC_CACHE,
    component: lazy(() => import("./pages/topic-page")),
    messages: [
      "@vitnode/forum.forums",
      "@vitnode/forum.topics",
      "@vitnode/forum.replies",
    ],
    pendingComponent: RoutePendingSkeleton,
    search: topicSearch,
  }),

  page("/forum/replies/:slug", {
    component: lazy(() => import("./pages/reply-redirect-page")),
    messages: ["@vitnode/forum.replies"],
    pendingComponent: RoutePendingSkeleton,
  }),
]);
