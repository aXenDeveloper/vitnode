import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";
import { handle } from "hono/vercel";

import { vitNodeApiConfig } from "@/vitnode.api.config";

const app = new OpenAPIHono().basePath("/api");
VitNodeAPI({
  app,
  vitNodeApiConfig,
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
