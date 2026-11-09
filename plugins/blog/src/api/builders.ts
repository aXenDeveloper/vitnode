import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
import { bindContentPlugin } from "@vitnode/core/content/server";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);
const contentBuilders = bindContentPlugin(manifest);

/** Module and route builders bound to the `@vitnode/blog` plugin id. */
export const buildModule = apiBuilders.buildModule,
  buildRoute = apiBuilders.buildRoute;

/**
 * The blog's generated Content Engine modules: `buildContentAdminModule` for
 * the AdminCP CRUD routes and `buildContentPublicModule` for the public ones.
 */
export const buildContentAdminModule = contentBuilders.buildContentAdminModule,
  buildContentPublicModule = contentBuilders.buildContentPublicModule;
