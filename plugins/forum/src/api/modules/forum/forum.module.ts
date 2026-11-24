import { buildModule } from "@/api/builders";
import { forumStatsEventListeners } from "@/api/lib/events";

import { forumFeedRoute } from "./routes/list-feed.route";
import { forumStatsRoute } from "./routes/list-forum-stats.route";
import { topicStatsRoute } from "./routes/list-topic-stats.route";
import { forumTopicsRoute } from "./routes/list-topics.route";
import { topicSlugRoute } from "./routes/show-topic-slug.route";

export const forumModule = buildModule({
  name: "forum",
  routes: [
    forumFeedRoute,
    forumStatsRoute,
    topicStatsRoute,
    topicSlugRoute,
    forumTopicsRoute,
  ],
  events: forumStatsEventListeners,
});
