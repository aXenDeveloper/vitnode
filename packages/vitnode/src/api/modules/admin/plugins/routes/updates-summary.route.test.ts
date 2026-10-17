import type { drizzle } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { UpdateComponent } from "@/api/lib/updates/components";

import { checkForUpdates } from "@/api/lib/updates/check";
import {
  acquireUpdateCheckLease,
  releaseUpdateCheckLease,
} from "@/api/lib/updates/lock";
import { core_update_lock } from "@/database/updates";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { pluginUpdatesSummaryAdminRoute } from "./updates-summary.route";

type Db = ReturnType<typeof drizzle>;

const ADMIN = { id: 1, roleId: 1 };
const CORE_SOURCE = "https://vitnode.example.com/updates.json";
const ACME_SOURCE = "https://acme.example.com/updates.json";
const CHECKED_AT = new Date("2026-10-15T03:00:00Z");

const advisory = (id: string) => ({
  affected: "<1.1.0",
  fixed: "1.1.0",
  id,
  url: `https://acme.example.com/advisories/${id}`,
});

const COMPONENTS: UpdateComponent[] = [
  {
    hasUnknownVersion: false,
    id: "@vitnode/core",
    kind: "core",
    sourceUrl: CORE_SOURCE,
    versions: ["2.0.0"],
  },
  // Its API and its web app both report a version: still one plugin.
  {
    hasUnknownVersion: false,
    id: "@acme/blog",
    kind: "plugin",
    sourceUrl: ACME_SOURCE,
    versions: ["1.0.1", "1.0.0"],
  },
  {
    hasUnknownVersion: false,
    id: "@acme/local",
    kind: "plugin",
    sourceUrl: null,
    versions: ["1.0.0"],
  },
];

const MANIFESTS: Record<string, unknown> = {
  [ACME_SOURCE]: {
    packages: {
      "@acme/blog": {
        channels: { stable: "1.1.0" },
        releases: { "1.1.0": {} },
        securityUpdates: [advisory("ACME-1"), advisory("ACME-2")],
      },
    },
    schemaVersion: 1,
  },
  [CORE_SOURCE]: {
    packages: {
      "@vitnode/core": {
        channels: { stable: "2.1.0" },
        releases: { "2.1.0": {} },
      },
    },
    schemaVersion: 1,
  },
};

const requestAs = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });
  const memory = createMemoryDb();
  const db = memory.db as unknown as Db;
  await acquireUpdateCheckLease(db, { manual: false, owner: "cron" });
  await checkForUpdates({
    channelOverride: null,
    components: COMPONENTS,
    coreVersion: "2.0.0",
    db,
    fetchSource: async url =>
      await Promise.resolve({
        body: MANIFESTS[url],
        etag: null,
        kind: "fetched" as const,
        lastModified: null,
      }),
    lease: { owner: "cron", signal: new AbortController().signal },
    now: CHECKED_AT,
  });
  await releaseUpdateCheckLease(db, "cron");
  const lockBefore = memory.rows(core_update_lock);

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
  app.openapi(
    pluginUpdatesSummaryAdminRoute.route,
    pluginUpdatesSummaryAdminRoute.handler,
  );

  return {
    lockBefore,
    memory,
    response: await app.request("/updates/summary"),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /admin/plugins/updates/summary", () => {
  it("summarises the stored results without starting a check", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);

    const { lockBefore, memory, response } = await requestAs([
      { module: "plugins", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      affectedComponents: 1,
      checkedComponents: 2,
      core: { latestVersion: "2.1.0", state: "checked", version: "2.0.0" },
      enabled: true,
      oldestSuccessAt: CHECKED_AT.toISOString(),
      pluginUpdatesAvailable: 1,
      running: false,
      totalComponents: 3,
      unconfirmedComponents: 1,
      updatesAvailable: 2,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(memory.rows(core_update_lock)).toEqual(lockBefore);
  });

  it("refuses an administrator without the plugins permission", async () => {
    const { response } = await requestAs([
      { module: "system", permission: "can_view", plugin: "@vitnode/core" },
    ]);

    expect(response.status).toBe(403);
  });
});
