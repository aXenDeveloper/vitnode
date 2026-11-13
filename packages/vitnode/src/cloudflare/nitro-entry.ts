// Passkeys verify certificates with `@peculiar/x509`, whose DI container checks
// for this polyfill when it loads. Bundled for Workers, the polyfill would run
// after that check; loaded here, it is in place before the app's server bundle
// is imported on the first request.
import "reflect-metadata";
import { fetchService } from "nitro/services";

import { createVitNodeRealtimeHub } from "./hub";

/**
 * The realtime hub of a Nitro app on Cloudflare Workers: the Durable Object
 * class the `VITNODE_REALTIME` binding names. `vitnode({ webSocket: {
 * transport: "cloudflare" } })` makes this module Nitro's server entry, so the
 * built Worker exports the class; nothing to import yourself. Its first
 * upgrade loads the app's server bundle through Nitro, which registers the
 * embedded API. Cloudflare Workers only.
 */
export const VitNodeRealtimeHub = createVitNodeRealtimeHub({
  warmup: async request => await fetchService("ssr", request),
});
