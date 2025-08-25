import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

VitNodeAPI({
  app,
  vitNodeApiConfig,
});

serve(
  {
    fetch: app.fetch,
    port: 8080,
  },
  info => {
    const initMessage = "\x1b[34m[VitNode]\x1b[0m";

    // biome-ignore lint/suspicious/noConsole: <start>
    console.log(
      `${initMessage} API server is running on http://localhost:${info.port}`,
    );
  },
);
