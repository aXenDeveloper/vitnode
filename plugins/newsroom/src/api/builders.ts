import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
import { bindContentPlugin } from "@vitnode/core/content/server";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);
const contentBuilders = bindContentPlugin(manifest);

/** The API builders, bound to this plugin's id. */
export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
export const buildQueueTask = apiBuilders.buildQueueTask;
export const defineCacheEntry = apiBuilders.defineCacheEntry;
export const defineEvent = apiBuilders.defineEvent;

/** The Content Engine's admin and public modules, bound to this plugin's id. */
export const buildContentAdminModule = contentBuilders.buildContentAdminModule;
export const buildContentPublicModule =
  contentBuilders.buildContentPublicModule;
