import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { buildInstalledPluginRegistry } from "@/api/lib/installed-plugins";
import { manifest } from "@/manifest";
import { createTestCache } from "@/tests/cache";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { listPluginsAdminRoute } from "./list.route";

const ADMIN = { id: 1, roleId: 1 };

const installedPlugins = buildInstalledPluginRegistry({
  api: [
    {
      manifest: {
        author: null,
        description: "Posts and categories",
        icon: "newspaper",
        id: "@acme/blog",
        license: null,
        title: "Blog",
        version: "2.0.0",
      },
      pluginId: "@acme/blog",
    },
  ],
  frontend: [
    {
      id: "@acme/blog",
      manifest: {
        author: null,
        description: "Posts and categories",
        icon: "newspaper",
        id: "@acme/blog",
        license: null,
        title: "Blog",
        version: "1.0.0",
      },
    },
    { id: "@acme/analytics", manifest: null },
  ],
});

const listAs = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("core", { installedPlugins } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(listPluginsAdminRoute.route, listPluginsAdminRoute.handler);

  return await app.request("/");
};

describe("GET /admin/plugins", () => {
  it("lists the installed plugins and the core version", async () => {
    const response = await listAs([
      { module: "plugins", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      core: {
        author: { name: manifest.author.name, url: manifest.author.url },
        license: manifest.license,
        version: manifest.version,
      },
      frontendInventory: true,
      plugins: installedPlugins.plugins,
    });
  });

  it("refuses an administrator without the plugins permission", async () => {
    const response = await listAs([
      { module: "system", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(403);
  });
});
