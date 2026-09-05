import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";

export const blogApiPlugin = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [
      adminModule,
      buildContentPublicModule({
        pluginId: CONFIG_PLUGIN.pluginId,
        // Skips any content type without `publicApi`, so the category
        // contributes nothing - it has no public URL of its own.
        contentTypes: [categoryContent, postContent],
      }),
    ],
  });
