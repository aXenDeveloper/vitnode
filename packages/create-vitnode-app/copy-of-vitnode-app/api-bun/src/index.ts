import { OpenAPIHono } from "@hono/zod-openapi";
import { websocketOriginMiddleware } from "@vitnode/api/middlewares/websocket-origin.middleware";
import { VitNodeAPI } from "@vitnode/api/config";
import { mcpWellKnownRequest } from "@vitnode/api/lib/mcp/well-known";
import { handleVitNodeWebSocket } from "@vitnode/api/ws/handle";
import { upgradeWebSocket, websocket } from "hono/bun";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

VitNodeAPI({
  app,
  vitNodeApiConfig,
});

// VitNode's shared WebSocket at `/api/ws`, upgraded by Bun itself. The
// handshake passes the Origin check and the API's middleware first, so the
// session cookie decides the user. Pass the web app's origin when it is not
// `VITNODE_WEB_URL`.
app.get(
  "/ws",
  websocketOriginMiddleware(),
  upgradeWebSocket(handleVitNodeWebSocket()),
);

// Bun serves this object: `bun --hot src/index.ts` in development (`vitnode
// dev`), `bun src/index.ts` in production (`vitnode start`). Bun pings idle
// sockets and drops dead ones itself.
export default {
  // MCP clients discover OAuth at the origin root (`/.well-known/...`),
  // outside the API's `/api` base path.
  fetch: async (request: Request, server: Parameters<typeof app.fetch>[1]) =>
    await app.fetch(
      mcpWellKnownRequest(request, { apiBasePath: "/api" }) ?? request,
      server,
    ),
  hostname: process.env.HOST,
  port: Number(process.env.PORT ?? 8000),
  websocket,
};
