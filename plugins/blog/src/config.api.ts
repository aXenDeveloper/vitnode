import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { blogAiActions } from "@/api/ai/actions";
import { buildContentPublicModule } from "@/api/builders";
import { adminModule } from "@/api/modules/admin/admin.module";
import { categoryContent } from "@/database/categories";
import { postContent } from "@/database/posts";
import { manifest } from "@/manifest.gen";

/**
 * The blog's API half, registered in the app's `src/vitnode.api.config.ts`
 * (`buildApiConfig({ plugins: [blogApiPlugin()] })`).
 *
 * It mounts:
 * - `admin` - the generated AdminCP content modules for articles and
 *   categories, the AI writing routes, and the compatibility event listeners
 *   from `@/api/lib/events`.
 * - `content/blog` - the public read and delivery routes the Content Engine
 *   generates from the article's `publicApi`. Categories have no `publicApi`,
 *   so they are not exposed publicly.
 *
 * The blog's AI actions (excerpt and translation) are registered here too.
 *
 * @example
 * ```ts
 * // src/vitnode.api.config.ts
 * import { blogApiPlugin } from "@vitnode/blog/config.api";
 * import { buildApiConfig } from "@vitnode/core/vitnode.config";
 *
 * export const vitNodeApiConfig = buildApiConfig({
 *   // ...
 *   plugins: [blogApiPlugin()],
 * });
 * ```
 */
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

/**
 * The blog API's route contract, which the generated app API registry reads so
 * `fetcher({ plugin: "@vitnode/blog", ... })` infers modules, paths and
 * responses.
 */
export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof blogApiPlugin>
>;
