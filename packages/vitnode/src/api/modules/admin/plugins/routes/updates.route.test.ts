import type { drizzle } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { UpdateComponent } from "@/api/lib/updates/components";

import { checkForUpdates } from "@/api/lib/updates/check";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { pluginUpdatesAdminRoute } from "./updates.route";

type Db = ReturnType<typeof drizzle>;

const ADMIN = { id: 1, roleId: 1 };
const SOURCE = "https://vitnode.example.com/updates.json";
const CHECKED_AT = new Date("2026-10-15T03:00:00Z");

const COMPONENTS: UpdateComponent[] = [
  {
    hasUnknownVersion: false,
    id: "@vitnode/core",
    kind: "core",
    sourceUrl: SOURCE,
    versions: ["2.0.0"],
  },
  {
    hasUnknownVersion: false,
    id: "@acme/blog",
    kind: "plugin",
    sourceUrl: null,
    versions: ["1.0.0"],
  },
];

const requestAs = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });
  const db = createMemoryDb().db as unknown as Db;
  await checkForUpdates({
    channelOverride: null,
    components: COMPONENTS,
    coreVersion: "2.0.0",
    db,
    fetchSource: async () =>
      await Promise.resolve({
        body: {
          packages: {
            "@vitnode/core": {
              channels: { stable: "2.1.0" },
              releases: { "2.1.0": {} },
            },
          },
          schemaVersion: 1,
        },
        etag: null,
        kind: "fetched" as const,
        lastModified: null,
      }),
    now: CHECKED_AT,
  });

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db);
    c.set("core", {
      updates: {
        channelOverride: null,
        components: COMPONENTS,
        coreVersion: "2.0.0",
        enabled: true,
      },
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(pluginUpdatesAdminRoute.route, pluginUpdatesAdminRoute.handler);

  return await app.request("/updates");
};

describe("GET /admin/plugins/updates", () => {
  it("returns core and the plugins from the stored results", async () => {
    const response = await requestAs([
      { module: "plugins", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      core: {
        id: "@vitnode/core",
        lastSuccessAt: CHECKED_AT.toISOString(),
        result: { latest: { version: "2.1.0" }, status: "update_available" },
        state: "checked",
      },
      enabled: true,
      plugins: [{ id: "@acme/blog", state: "unavailable" }],
      running: false,
    });
  });

  it("refuses an administrator without the plugins permission", async () => {
    const response = await requestAs([
      { module: "system", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(403);
  });
});
