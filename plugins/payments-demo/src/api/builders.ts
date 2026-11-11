import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);

/** The API builders, bound to this plugin's id. */
export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
export const buildQueueTask = apiBuilders.buildQueueTask;
export const defineCacheEntry = apiBuilders.defineCacheEntry;
export const defineEvent = apiBuilders.defineEvent;
