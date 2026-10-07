// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { clearSearchDebugAdminRoute } from "./clear-search.route";
import { rebuildSearchDebugAdminRoute } from "./rebuild-search.route";

const ADMIN = { id: 1, roleId: 1 };

const system = (permission: string): PermissionsStaffArgs => ({
  module: "system",
  permission,
  plugin: "@vitnode/core",
});

const appWith = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("core", { searchIndexers: [] } as unknown as Context["var"]["core"]);
    c.set("queue", {
      dispatch: async () => await Promise.resolve(),
    } as unknown as Context["var"]["queue"]);
    c.set("search", {
      clear: async () => await Promise.resolve(),
    } as unknown as Context["var"]["search"]);
    c.set("log", {
      warn: async () => await Promise.resolve(),
    } as unknown as Context["var"]["log"]);
    await next();
  });
  app.openapi(
    rebuildSearchDebugAdminRoute.route,
    rebuildSearchDebugAdminRoute.handler,
  );
  app.openapi(
    clearSearchDebugAdminRoute.route,
    clearSearchDebugAdminRoute.handler,
  );

  return app;
};

const post = async (app: OpenAPIHono, path: string, body: object) =>
  await app.request(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

describe.each([
  ["/search/rebuild", {}],
  ["/search/clear", { itemType: "unmanaged.collection" }],
])("POST %s", (path, body) => {
  it("refuses an administrator who can only view the system panel", async () => {
    const app = await appWith([system("can_view")]);

    expect((await post(app, path, body)).status).toBe(403);
  });

  it("is allowed with the search management permission", async () => {
    const app = await appWith([
      system("can_view"),
      system("can_manage_search"),
    ]);

    expect((await post(app, path, body)).status).toBe(200);
  });
});
