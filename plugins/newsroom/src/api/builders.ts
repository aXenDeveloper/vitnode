import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
import { bindContentPlugin } from "@vitnode/core/content/server";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);

export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
const contentBuilders = bindContentPlugin(manifest);

export const buildContentAdminModule = contentBuilders.buildContentAdminModule;
export const buildContentPublicModule =
  contentBuilders.buildContentPublicModule;
