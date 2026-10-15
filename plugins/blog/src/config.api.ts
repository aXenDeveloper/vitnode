import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { blogAiActions } from "@/api/ai/actions";
import { buildContentPublicModule } from "@/api/builders";
import { adminModule } from "@/api/modules/admin/admin.module";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";
import { manifest } from "@/manifest.gen";

export const blogApiPlugin = () =>
  buildApiPlugin({
    manifest,
    aiActions: blogAiActions,
    modules: [
      adminModule,
      buildContentPublicModule({
        // Skips any content type without `publicApi`, so the category
        // contributes nothing - it has no public URL of its own.
        contentTypes: [categoryContent, postContent],
      }),
    ],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof blogApiPlugin>
>;
