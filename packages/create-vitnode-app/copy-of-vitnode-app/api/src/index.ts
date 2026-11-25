import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/api/config";
import { mcpWellKnownRequest } from "@vitnode/api/lib/mcp/well-known";
import "hono";

import { vitNodeApiConfig } from "./vitnode.api.config.js";

const app = new OpenAPIHono().basePath("/api");

VitNodeAPI({
  app,
  vitNodeApiConfig,
});

const server = serve(
  {
    // MCP clients discover OAuth at the origin root (`/.well-known/...`),
    // outside the API's `/api` base path.
    fetch: async (request, env) =>
      await app.fetch(
        mcpWellKnownRequest(request, { apiBasePath: "/api" }) ?? request,
        env,
      ),
    hostname: process.env.HOST,
    port: Number(process.env.PORT ?? 8000),
  },
);

export default server;
