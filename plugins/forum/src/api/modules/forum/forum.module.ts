import { buildModule } from "@/api/builders";
import { forumStatsEventListeners } from "@/api/lib/events";

import {
  forumStatsRoute,
  topicSlugRoute,
  topicStatsRoute,
} from "./stats.routes";
import { forumTopicsRoute } from "./topics.routes";

export const forumModule = buildModule({
  name: "forum",
  routes: [forumStatsRoute, topicStatsRoute, topicSlugRoute, forumTopicsRoute],
  events: forumStatsEventListeners,
});
