// @vitest-environment node
import type { MiddlewareHandler } from "hono";

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { buildRoute } from "./route";

const okResponse = {
  200: {
    content: {
      "application/json": { schema: z.object({ plugin: z.string() }) },
    },
    description: "ok",
  },
} as const;

const mount = (route: ReturnType<typeof buildRoute>) => {
  const app = new OpenAPIHono();
  app.openapi(route.route, route.handler);

  return app;
};

describe("buildRoute", () => {
  it("keeps pluginMiddleware when the route brings its own middleware", async () => {
    const marks: string[] = [];
    const custom: MiddlewareHandler = async (_c, next) => {
      marks.push("custom");
      await next();
    };

    const route = buildRoute({
      pluginId: "@vitnode/test",
      route: {
        method: "get",
        path: "/",
        middleware: [custom],
        responses: okResponse,
      },
      handler: c => c.json({ plugin: c.get("plugin").id }, 200),
    });

    const res = await mount(route).request("/");

    expect(res.status).toBe(200);
    // Without the fix the `...route` spread replaced the composed array and
    // `c.get("plugin")` was undefined.
    expect(await res.json()).toEqual({ plugin: "@vitnode/test" });
    expect(marks).toEqual(["custom"]);
  });

  it("composes pluginMiddleware, the permission guard and route middleware in order", () => {
    const custom: MiddlewareHandler = async (_c, next) => next();

    const { route } = buildRoute({
      pluginId: "@vitnode/test",
      adminStaffPermission: { module: "articles", permission: "can_view" },
      route: {
        method: "get",
        path: "/",
        middleware: [custom],
        responses: okResponse,
      },
      handler: c => c.json({ plugin: c.get("plugin").id }, 200),
    });

    const middleware = route.middleware;

    expect(middleware).toHaveLength(3);
    expect(middleware.at(-1)).toBe(custom);
  });

  it("prepends the plugin tag and keeps route tags", () => {
    const { route } = buildRoute({
      pluginId: "@vitnode/test_plugin",
      route: {
        method: "get",
        path: "/",
        tags: ["Articles"],
        responses: okResponse,
      },
      handler: c => c.json({ plugin: c.get("plugin").id }, 200),
    });

    expect(route.tags).toEqual(["Test Plugin", "Articles"]);
  });
});
