import type { drizzle } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import {
  acquireUpdateCheckLease,
  releaseUpdateCheckLease,
} from "@/api/lib/updates/lock";
import { core_update_lock } from "@/database/updates";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { checkPluginUpdatesAdminRoute } from "./check-updates.route";

type Db = ReturnType<typeof drizzle>;

const ADMIN = { id: 1, roleId: 1 };

const CAN_CHECK: PermissionsStaffArgs[] = [
  { module: "plugins", permission: "can_view", plugin: "@vitnode/core" },
  {
    module: "plugins",
    permission: "can_check_updates",
    plugin: "@vitnode/core",
  },
];

const checkAs = async (
  permissions: PermissionsStaffArgs[],
  {
    enabled = true,
    prepare,
    wrap = db => db,
  }: {
    enabled?: boolean;
    prepare?: (db: Db) => Promise<void>;
    wrap?: (db: Db) => Db;
  } = {},
) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });
  const db = wrap(createMemoryDb().db as unknown as Db);
  await prepare?.(db);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db);
    c.set("core", {
      updates: {
        channelOverride: null,
        // No update sources: the check runs end to end without the network.
        components: [
          {
            hasUnknownVersion: false,
            id: "@vitnode/core",
            kind: "core",
            sourceUrl: null,
            versions: ["2.0.0"],
          },
        ],
        coreVersion: "2.0.0",
        enabled,
      },
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(
    checkPluginUpdatesAdminRoute.route,
    checkPluginUpdatesAdminRoute.handler,
  );

  return await app.request("/updates/check", { method: "POST" });
};

describe("POST /admin/plugins/updates/check", () => {
  it("runs the check for an administrator allowed to", async () => {
    const response = await checkAs(CAN_CHECK);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      securityUpdates: 0,
      components: 0,
      failedSources: 0,
      sources: 0,
      status: "completed",
      updates: 0,
    });
  });

  it("refuses an administrator who can only view plugins", async () => {
    const response = await checkAs(CAN_CHECK.slice(0, 1));

    expect(response.status).toBe(403);
  });

  it.each([
    [
      "a check is already running",
      {
        prepare: async (db: Db) => {
          await acquireUpdateCheckLease(db, { manual: false, owner: "cron" });
        },
      },
      409,
      "running",
    ],
    [
      "a manual check ran moments ago",
      {
        prepare: async (db: Db) => {
          await acquireUpdateCheckLease(db, { manual: true, owner: "earlier" });
          await releaseUpdateCheckLease(db, "earlier");
        },
      },
      429,
      "cooldown",
    ],
  ])("answers %s with a Retry-After", async (_, options, status, body) => {
    const response = await checkAs(CAN_CHECK, options);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ status: body });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("answers 409 when the check lost its lease midway", async () => {
    const takenOverMidCheck = (db: Db): Db => {
      let transactions = 0;

      return new Proxy(db, {
        get: (target, property, receiver) =>
          property === "transaction"
            ? async (...args: Parameters<Db["transaction"]>) => {
                transactions += 1;
                if (transactions === 2) {
                  const [lease] = await target
                    .select({ owner: core_update_lock.owner })
                    .from(core_update_lock);
                  await releaseUpdateCheckLease(target, lease?.owner ?? "");
                  await acquireUpdateCheckLease(target, {
                    manual: false,
                    owner: "other",
                  });
                }

                return await target.transaction(...args);
              }
            : (Reflect.get(target, property, receiver) as unknown),
      });
    };

    const response = await checkAs(CAN_CHECK, { wrap: takenOverMidCheck });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      retryAfterSeconds: null,
      status: "interrupted",
    });
  });

  it("answers 409 while update checks are turned off", async () => {
    const response = await checkAs(CAN_CHECK, { enabled: false });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      retryAfterSeconds: null,
      status: "disabled",
    });
  });
});
