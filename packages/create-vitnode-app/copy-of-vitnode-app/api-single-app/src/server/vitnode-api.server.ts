import "@tanstack/react-start/server-only";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";
import { websocketOriginMiddleware } from "@vitnode/core/api/middlewares/websocket-origin.middleware";
import { configureInProcessApi } from "@vitnode/core/lib/fetcher/in-process-api.server";
import { upgradeWebSocket } from "@vitnode/core/ws/crossws.server";
import { handleVitNodeWebSocket } from "@vitnode/core/ws/handle";

import { createApiBridge } from "@/server/api-bridge";
import { vitNodeApiConfig } from "@/vitnode.api.config";

// The same two lines `apps/api` and `apps/docs` run. `basePath("/api")` is what
// makes the mount point part of the API's own routing, so every path the plugins
// register - `/api/@vitnode/core/...` - resolves identically here.
const createVitNodeApi = () => {
  const app = new OpenAPIHono().basePath("/api");

  VitNodeAPI({ app, vitNodeApiConfig });

  // The handshake half of `/api/ws`: Nitro's route (`./websocket.ts`) sends
  // each upgrade through here, so it passes the Origin check and the API's
  // middleware before the socket opens. A handshake is a cookie-authenticated
  // GET that neither CSRF nor the same-origin policy covers - see the middleware.
  app.get(
    "/ws",
    websocketOriginMiddleware(),
    upgradeWebSocket(handleVitNodeWebSocket()),
  );

  return app;
};

// Built on every evaluation of this module. In production that is once per
// process. In development Vite evaluates it again whenever a plugin's API code
// changes, so a new content type option or route is live without a restart;
// `VitNodeAPI` keeps the Redis connection and the cron schedule it created
// first, so nothing boots twice.
export const vitNodeApi = createVitNodeApi();

export const apiBridge = createApiBridge(vitNodeApi);

// Server-side fetches from loaders, middleware and server functions reach this
// API directly instead of over HTTP to this same server - unless
// `VITNODE_API_URL` points at a separate API.
configureInProcessApi(apiBridge);
