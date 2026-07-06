import type { StorageStaticConfig } from "@vitnode/core/api/models/storage";

import { serve, upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";
import { handleVitNodeWebSocket } from "@vitnode/core/ws/handle";
import { mkdirSync } from "node:fs";
import { WebSocketServer } from "ws";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

// Serve locally stored uploads (Local storage adapter) before VitNodeAPI so the
// request skips cors/csrf/rate-limiter/global middleware. No-op for cloud adapters.
// Annotated explicitly: the nested type inferred through the config chain widens
// to `any` under NodeNext, so we re-attach the directly-imported type here.
const staticStorage: StorageStaticConfig | undefined =
  vitNodeApiConfig.storage?.adapter?.static;
if (staticStorage) {
  // Create the uploads directory up front so serveStatic doesn't warn about a
  // missing root before the first file is uploaded.
  mkdirSync(staticStorage.root, { recursive: true });
  app.get(
    staticStorage.mountPath,
    serveStatic({
      root: staticStorage.root,
      rewriteRequestPath: path =>
        path.startsWith(staticStorage.stripPrefix)
          ? path.slice(staticStorage.stripPrefix.length)
          : path,
    }),
  );
}

// Allow the web frontend to make credentialed browser requests (e.g. client-side
// file uploads) when it runs on a different origin than this API. Credentialed
// requests can't use a wildcard origin, and CSRF must trust it too.
const webOrigin = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

VitNodeAPI({
  app,
  vitNodeApiConfig,
  cors: { credentials: true, origin: webOrigin },
  csrf: { origin: webOrigin },
});

const wss = new WebSocketServer({ noServer: true });

app.get("/ws", upgradeWebSocket(handleVitNodeWebSocket()));

serve(
  {
    fetch: app.fetch,
    port: 8080,
    websocket: {
      server: wss,
    },
  },
  info => {
    const initMessage = "\x1b[34m[VitNode]\x1b[0m";

    // eslint-disable-next-line no-console
    console.log(
      `${initMessage} API server is running on http://localhost:${info.port}`,
    );
  },
);
