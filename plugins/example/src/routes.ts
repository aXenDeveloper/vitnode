import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "@vitnode/core/routing";
import {
  FeedPendingSkeleton,
  RoutePendingSkeleton,
} from "@vitnode/core/tanstack/pending";

import type { ExampleSearch } from "./pages/example-page";

import { boardSearch } from "./pages/board-search";
import { browseSearch } from "./pages/browse-search";
import {
  discussionNewSearch,
  discussionSearch,
} from "./pages/discussion-search";
import { zonesSearch } from "./pages/zones-search";

export const routes = definePluginRoutes([
  page("/example/:slug", {
    component: lazy(() => import("./pages/example-page")),
    search: (input): ExampleSearch => ({
      tab: input.tab === "details" ? "details" : "summary",
    }),
  }),

  page("/example/browse", {
    component: lazy(() => import("./pages/browse-page")),
    messages: ["@vitnode/example.browse"],
    search: browseSearch,
  }),

  page("/example/zones", {
    component: lazy(() => import("./pages/zones-page")),
    search: zonesSearch,
  }),

  page("/example/embed", {
    area: "blank",
    component: lazy(() => import("./pages/embed-page")),
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

  page("/articles/:slug", {
    component: lazy(() => import("./pages/article-page")),
    messages: ["@vitnode/example.articles"],
  }),

  page("/advanced-articles/:slug", {
    component: lazy(() => import("./pages/advanced-article-page")),
    messages: ["@vitnode/example.articles"],
  }),

  page("/events/:slug", {
    component: lazy(() => import("./pages/event-page")),
    messages: ["@vitnode/example.articles", "@vitnode/example.events"],
  }),

  page("/localized-articles/:slug", {
    component: lazy(() => import("./pages/localized-article-page")),
    messages: ["@vitnode/example.articles"],
  }),

  page("/boards", {
    component: lazy(() => import("./pages/boards-page")),
    messages: ["@vitnode/example.boards"],
    pendingComponent: RoutePendingSkeleton,
  }),

  page("/boards/:slug", {
    component: lazy(() => import("./pages/board-page")),
    messages: ["@vitnode/example.boards"],
    pendingComponent: FeedPendingSkeleton,
    search: boardSearch,
  }),

  page("/discussions/new", {
    component: lazy(() => import("./pages/discussion-new-page")),
    messages: ["@vitnode/example.discussions"],
    requires: "authenticated",
    search: discussionNewSearch,
  }),

  page("/discussions/:id/edit", {
    component: lazy(() => import("./pages/discussion-edit-page")),
    messages: ["@vitnode/example.discussions"],
  }),

  page("/discussions/:slug", {
    component: lazy(() => import("./pages/discussion-page")),
    messages: ["@vitnode/example.articles", "@vitnode/example.discussions"],
    search: discussionSearch,
  }),

  page("/admin/example", {
    area: "admin",
    component: lazy(() => import("./pages/admin-example-page")),
    messages: ["@vitnode/example.admin.overview"],
  }),
]);
