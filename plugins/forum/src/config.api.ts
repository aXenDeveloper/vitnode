import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { forumModule } from "@/api/modules/forum/forum.module";
import { CONFIG_PLUGIN } from "@/const";
import { forumContainers } from "@/content/forums";
import { replyContent } from "@/database/replies";
import { topicContent } from "@/database/topics";

export const forumApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    navigation: [{ href: "/forum", icon: "messages-square", id: "forum" }],
    modules: [
      adminModule,
      forumModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        containers: [forumContainers],
        contentTypes: [topicContent, replyContent],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof forumApiPlugin>
>;
