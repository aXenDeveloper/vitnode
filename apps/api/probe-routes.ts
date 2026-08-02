import { OpenAPIHono } from "@hono/zod-openapi";
import { VitNodeAPI } from "@vitnode/core/api/config";

import { vitNodeApiConfig } from "./src/vitnode.api.config";

const app = new OpenAPIHono().basePath("/api");
VitNodeAPI({ app, vitNodeApiConfig });

const paths = app.routes
  .map(r => `${r.method.padEnd(7)} ${r.path}`)
  .filter(p => p.includes("example"));
console.log([...new Set(paths)].sort().join("\n"));
console.log("\ntotal example routes:", new Set(paths).size);
