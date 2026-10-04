// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterAll, beforeAll, expect, it } from "vitest";
import { z } from "zod";

import { buildNotificationType } from "@/api/lib/notifications/registry";
import { createTestCache } from "@/tests/cache";
import {
  createNotificationsHarness,
  type NotificationsHarness,
} from "@/tests/notifications";
import { describePostgres } from "@/tests/postgres";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import {
  deleteAllNotificationsRoute,
  resetMemberNotificationPreferencesRoute,
} from "./danger.route";
import { getNotificationStatsRoute } from "./stats.route";

const pingType = buildNotificationType({
  id: "test.ping",
  version: 1,
  schema: z.object({}),
  category: "system",
  label: "test.ping.label",
  defaults: { email: "none", inApp: true },
  present: () => ({ title: "Ping" }),
});

const VIEWER = { email: "viewer@example.com", id: 1 };
const MANAGER = { email: "manager@example.com", id: 2 };
const PLUGIN = "@vitnode/core";

const SHARED_KEYS = [
  "core",
  "db",
  "email",
  "events",
  "i18n",
  "log",
  "notifications",
  "queue",
  "realtime",
];

describePostgres("AdminCP notification danger routes", () => {
  let h: NotificationsHarness;
  const cache = createTestCache();

  beforeAll(async () => {
    h = await createNotificationsHarness({ types: [pingType] });
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "notifications", permission: "can_view", plugin: PLUGIN },
      ],
      userId: VIEWER.id,
    });
    await grantStaffPermissions(cache, {
      permissions: [
        { module: "notifications", permission: "can_view", plugin: PLUGIN },
        { module: "notifications", permission: "can_manage", plugin: PLUGIN },
      ],
      userId: MANAGER.id,
    });
  });

  afterAll(async () => {
    await h?.database.drop();
  });

  const appFor = (admin: typeof VIEWER) => {
    const app = new OpenAPIHono();
    app.use("*", async (c, next) => {
      for (const key of SHARED_KEYS) {
        c.set(key as never, h.c.get(key as never));
      }
      c.set("cache", cache);
      c.set("admin", { user: admin } as unknown as Context["var"]["admin"]);
      await next();
    });
    for (const route of [
      deleteAllNotificationsRoute,
      resetMemberNotificationPreferencesRoute,
      getNotificationStatsRoute,
    ]) {
      app.openapi(route.route, route.handler);
    }

    return app;
  };

  it("refuses destructive actions to staff without the manage permission", async () => {
    const app = appFor(VIEWER);

    expect((await app.request("/delete-all", { method: "POST" })).status).toBe(
      403,
    );
    expect(
      (await app.request("/members/reset-preferences", { method: "POST" }))
        .status,
    ).toBe(403);
  });

  it("runs them for staff who may manage notifications", async () => {
    const app = appFor(MANAGER);

    const response = await app.request("/delete-all", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ events: 0, items: 0 });
  });

  it("serves activity to staff who may view notifications, and rejects unknown time zones", async () => {
    const app = appFor(VIEWER);

    const ok = await app.request("/stats?range=7d&timeZone=Europe%2FWarsaw");
    const bad = await app.request("/stats?range=7d&timeZone=Mars%2FOlympus");

    expect(ok.status).toBe(200);
    expect((await ok.json()).points).toHaveLength(7);
    expect(bad.status).toBe(400);
  });
});
