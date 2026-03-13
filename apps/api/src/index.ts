import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";
import { createNodeWebSocket } from "@hono/node-ws";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

VitNodeAPI({
  app,
  vitNodeApiConfig,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

const wsApp = app.get(
  "/ws",
  upgradeWebSocket(c => ({
    onOpen(event, ws) {
      const user = c.get("user");
      console.log("Connection opened", event, ws, user);
    },
    onMessage(event, ws) {
      console.log(`Message from client`, event.data);
      ws.send("Hello from server!");
    },
    onClose: () => {
      console.log("Connection closed");
    },
  })),
);

export type WebSocketApp = typeof wsApp;

const server = serve(
  {
    fetch: app.fetch,
    port: 8080,
  },
  info => {
    const initMessage = "\x1b[34m[VitNode]\x1b[0m";

    // eslint-disable-next-line no-console
    console.log(
      `${initMessage} API server is running on http://localhost:${info.port}`,
    );
  },
);
injectWebSocket(server);
