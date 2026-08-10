import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";
import { buildContentPublicModule } from "@vitnode/core/content/server";

import { adminModule } from "@/api/modules/admin/admin.module";
import { CONFIG_PLUGIN } from "@/const";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";

/**
 * No `contentTypes` here: `buildApiPlugin` walks the module tree, so the content
 * types declared in `admin.module.ts` also drive the registry and the derived
 * `can_view` / `can_create` / `can_edit` / `can_delete` / `can_publish` /
 * `can_restore` / `can_translate` permissions.
 *
 * No `searchIndexers` either. The article's `search` block is the indexer now -
 * one document per published translation, written by the engine in the same
 * transaction as the mutation that caused it.
 *
 * `permissionStaff` names the same two modules the blog always used, so an
 * existing role's stored permissions still address the right thing. Only the
 * generated additions - publish, restore, translate - are new, and a role that
 * does not have them is denied by default.
 */
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
