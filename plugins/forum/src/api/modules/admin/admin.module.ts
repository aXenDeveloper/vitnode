import { buildModule } from "@vitnode/core/api/lib/module";
import { buildContentAdminModule } from "@vitnode/core/content/server";

import { CONFIG_PLUGIN } from "@/const";
import { forumContainers } from "@/content/forums";
import { replyContent } from "@/database/replies";
import { topicContent } from "@/database/topics";

export const adminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "admin",
  routes: [],
  modules: [
    buildContentAdminModule({
      pluginId: CONFIG_PLUGIN.pluginId,
      containers: [forumContainers],
      contentTypes: [topicContent, replyContent],
    }),
  ],
});
