import type { Context, MiddlewareHandler } from "hono";

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import { defineStaffPermissions } from "@/lib/staff-permissions";
import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

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
      adminStaffPermission: defineStaffPermissions(
        { id: "@vitnode/test" },
        { admin: { articles: ["can_view"] } },
      ).admin.articles.canView,
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
});

describe("buildRoute staff permission guards", () => {
  const ADMIN = { id: 1, roleId: 1 };
  const owner = defineStaffPermissions(
    { id: "@vitnode/route-owner" },
    { admin: { notes: ["can_view"] }, moderator: { notes: ["can_view"] } },
  );
  const foreign = defineStaffPermissions(
    { id: "@vitnode/foreign" },
    { admin: { notes: ["can_view"] } },
  );

  const requestAs = async (granted: { plugin: string }) => {
    const cache = createTestCache();
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "notes", permission: "can_view", plugin: granted.plugin },
      ],
      userId: ADMIN.id,
    });
    const app = new OpenAPIHono();
    app.use("*", async (c, next) => {
      c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
      c.set("cache", cache);
      await next();
    });
    const route = buildRoute({
      pluginId: "@vitnode/route-owner",
      adminStaffPermission: foreign.admin.notes.canView,
      route: { method: "get", path: "/", responses: okResponse },
      handler: c => c.json({ plugin: c.get("plugin").id }, 200),
    });
    app.route("/", mount(route));

    return (await app.request("/")).status;
  };

  it("checks another plugin's reference against that plugin, not the route's", async () => {
    expect(await requestAs({ plugin: "@vitnode/route-owner" })).toBe(403);
    expect(await requestAs({ plugin: "@vitnode/foreign" })).toBe(200);
  });

  it.each([
    ["adminStaffPermission", owner.moderator.notes.canView],
    ["moderatorStaffPermission", owner.admin.notes.canView],
  ] as const)(
    "refuses a reference of the other staff type in %s from an untyped caller",
    (option, ref) => {
      expect(() =>
        buildRoute({
          pluginId: "@vitnode/route-owner",
          [option]: ref as never,
          route: { method: "get", path: "/", responses: okResponse },
          handler: c => c.json({ plugin: c.get("plugin").id }, 200),
        }),
      ).toThrow(/received the (admin|moderator) permission/);
    },
  );
});
