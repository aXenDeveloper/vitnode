import { manifest } from "@/manifest";

import { bindApiPlugin } from "./lib/bind-api-plugin";

const apiBuilders = bindApiPlugin(manifest);

/** Core's own builders, bound to `@vitnode/core`. Plugins bind their own with `bindApiPlugin`. */
export const buildModule = apiBuilders.buildModule,
  buildQueueTask = apiBuilders.buildQueueTask,
  buildRoute = apiBuilders.buildRoute,
  defineCacheEntry = apiBuilders.defineCacheEntry,
  defineEvent = apiBuilders.defineEvent;
