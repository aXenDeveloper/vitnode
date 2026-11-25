import { bindContentPlugin } from "@vitnode/api/content/server";
import { bindApiPlugin } from "@vitnode/api/lib/bind-api-plugin";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);
const contentBuilders = bindContentPlugin(manifest);

/** The API builders, bound to this plugin's id. */
export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
export const buildQueueTask = apiBuilders.buildQueueTask;
export const defineCacheEntry = apiBuilders.defineCacheEntry;
export const defineEvent = apiBuilders.defineEvent;
export const defineMcpTool = apiBuilders.defineMcpTool;

/** The Content Engine's admin and public modules, bound to this plugin's id. */
export const buildContentAdminModule = contentBuilders.buildContentAdminModule;
export const buildContentPublicModule =
  contentBuilders.buildContentPublicModule;
