import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
import { bindContentPlugin } from "@vitnode/core/content/server";

import { manifest } from "@/manifest.gen";

/** Module and route builders bound to the `@vitnode/blog` plugin id. */
export const { buildModule, buildRoute } = bindApiPlugin(manifest);
/**
 * The blog's generated Content Engine modules: `buildContentAdminModule` for
 * the AdminCP CRUD routes and `buildContentPublicModule` for the public ones.
 */
export const { buildContentAdminModule, buildContentPublicModule } =
  bindContentPlugin(manifest);
