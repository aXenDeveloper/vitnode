import { buildModule } from "@/api/builders";

import {
  forumStatsRoute,
  topicSlugRoute,
  topicStatsRoute,
} from "./stats.routes";

export const forumModule = buildModule({
  name: "forum",
  routes: [forumStatsRoute, topicStatsRoute, topicSlugRoute],
});
