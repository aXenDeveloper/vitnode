import { serve, upgradeWebSocket } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";
import { handleVitNodeWebSocket } from "@vitnode/core/ws/handle";
import { WebSocketServer } from "ws";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

VitNodeAPI({
  app,
  vitNodeApiConfig,
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
