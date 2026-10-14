import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import {
  forumStatsRoute,
  topicSlugRoute,
  topicStatsRoute,
} from "./stats.routes";

export const forumModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "forum",
  routes: [forumStatsRoute, topicStatsRoute, topicSlugRoute],
});
