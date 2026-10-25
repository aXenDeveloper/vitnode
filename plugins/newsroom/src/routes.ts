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

import type { NoteSearch } from "./pages/note-page";

import { manifest } from "./manifest.gen";
import { articleList } from "./pages/article-list";
import { browseSearch } from "./pages/browse-search";
import { deskSearch } from "./pages/desk-search";
import { letterListSearch } from "./pages/letter-list";
import { letterNewSearch, letterSearch } from "./pages/letter-search";
import { zonesSearch } from "./pages/zones-search";

export const routes = definePluginRoutes([
  page("/newsroom", {
    component: lazy(() => import("./pages/home-page")),
    messages: [`${manifest.id}.home`],
  }),

  page("/news", {
    component: lazy(() => import("./pages/articles-page")),
    messages: ["newsroom.articles"],
    search: articleList.parseSearch,
  }),

  page("/news/new", {
    component: lazy(() => import("./pages/article-new-page")),
    messages: ["newsroom.articles"],
    requires: "authenticated",
  }),

  page("/news/:id/edit", {
    component: lazy(() => import("./pages/article-edit-page")),
    messages: ["newsroom.articles"],
  }),

  page("/news/:slug", {
    component: lazy(() => import("./pages/article-page")),
    messages: ["newsroom.articles", "newsroom.comments"],
  }),

  page("/newsroom/notes/:slug", {
    component: lazy(() => import("./pages/note-page")),
    search: (input): NoteSearch => ({
      tab: input.tab === "details" ? "details" : "summary",
    }),
  }),

  page("/newsroom/browse", {
    component: lazy(() => import("./pages/browse-page")),
    messages: ["newsroom.browse"],
    search: browseSearch,
  }),

  page("/newsroom/pages/:slug", {
    component: lazy(() => import("./pages/site-page")),
  }),

  page("/newsroom/zones", {
    component: lazy(() => import("./pages/zones-page")),
    search: zonesSearch,
  }),

  page("/newsroom/embed", {
    area: "blank",
    component: lazy(() => import("./pages/embed-page")),
  }),

  layout("/newsroom/guide", {
    component: lazy(() => import("./pages/guide-layout")),
    messages: ["newsroom.guide"],
    children: [
      /** The page at the layout's own URL - `/newsroom/guide`. */
      index({
        component: lazy(() => import("./pages/guide-index-page")),
      }),

      page(":topic", {
        component: lazy(() => import("./pages/guide-topic-page")),
      }),
    ],
  }),

  page("/stories/:slug", {
    component: lazy(() => import("./pages/story-page")),
    messages: ["newsroom.stories"],
  }),

  page("/explainers/:slug", {
    component: lazy(() => import("./pages/explainer-page")),
    messages: ["newsroom.stories"],
  }),

  page("/events/:slug", {
    component: lazy(() => import("./pages/event-page")),
    messages: ["newsroom.stories", "newsroom.events"],
  }),

  page("/bulletins/:slug", {
    component: lazy(() => import("./pages/bulletin-page")),
    messages: ["newsroom.stories"],
  }),

  page("/desks", {
    component: lazy(() => import("./pages/desks-page")),
    messages: ["newsroom.desks"],
    pendingComponent: RoutePendingSkeleton,
  }),

  page("/desks/:slug", {
    component: lazy(() => import("./pages/desk-page")),
    messages: ["newsroom.desks"],
    pendingComponent: FeedPendingSkeleton,
    search: deskSearch,
  }),

  page("/letters", {
    component: lazy(() => import("./pages/letters-page")),
    messages: ["newsroom.letters"],
    pendingComponent: FeedPendingSkeleton,
    search: letterListSearch,
  }),

  page("/letters/new", {
    component: lazy(() => import("./pages/letter-new-page")),
    messages: ["newsroom.letters"],
    requires: "authenticated",
    search: letterNewSearch,
  }),

  page("/letters/:id/edit", {
    component: lazy(() => import("./pages/letter-edit-page")),
    messages: ["newsroom.letters"],
  }),

  page("/letters/:slug", {
    component: lazy(() => import("./pages/letter-page")),
    messages: ["newsroom.stories", "newsroom.letters"],
    search: letterSearch,
  }),

  page("/admin/newsroom", {
    area: "admin",
    component: lazy(() => import("./pages/admin-overview-page")),
    messages: ["newsroom.admin.overview"],
  }),
]);
