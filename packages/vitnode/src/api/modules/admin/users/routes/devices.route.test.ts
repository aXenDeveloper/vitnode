// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { buildModule } from "@/api/lib/module";
import {
  adminSessionCacheKey,
  sessionCacheKey,
} from "@/api/models/session-cache";
import { CONFIG_PLUGIN } from "@/config";
import { core_admin_permissions, core_admin_sessions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import {
  core_sessions,
  core_sessions_known_devices,
} from "@/database/sessions";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { listUserDevicesAdminRoute } from "./devices.route";
import { revokeUserDeviceAdminRoute } from "./revoke-device.route";
import { revokeUserDevicesAdminRoute } from "./revoke-devices.route";

const MEMBER_ROLE = 3;
const EDITOR = { email: "editor@example.com", id: 1, roleId: MEMBER_ROLE };
const TARGET_ID = 7;
const OTHER_ID = 8;
const MODERATOR_ID = 9;

const permission = (name: string): PermissionsStaffArgs => ({
  module: "users",
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_VIEW = permission("can_view");
const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");

const PHONE = { id: 4, lastSeen: new Date("2026-09-30"), publicId: "phone" };
const OFFICE = { id: 5, lastSeen: new Date("2026-09-20"), publicId: "office" };
const LAPTOP = { id: 3, lastSeen: new Date("2026-09-10"), publicId: "laptop" };
const TABLET = { id: 6, lastSeen: new Date("2026-09-25"), publicId: "tablet" };

const userRow = (id: number) => ({
  email: `${id}@example.com`,
  id,
  name: `user-${id}`,
  nameCode: `user-${id}`,
  roleId: MEMBER_ROLE,
});

const harness = async (editor: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: editor,
    userId: EDITOR.id,
  });

  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  const expired = new Date(Date.now() - 1000);
  const session = (userId: number, deviceId: number, at = expiresAt) => ({
    deviceId,
    expiresAt: at,
    token: `token-${userId}-${deviceId}`,
    userId,
  });

  const memory = createMemoryDb([
    [
      core_users,
      [EDITOR, userRow(TARGET_ID), userRow(OTHER_ID), userRow(MODERATOR_ID)],
    ],
    [core_users_secondary_roles, []],
    [core_roles, [{ guest: false, id: MEMBER_ROLE, root: false }]],
    [core_admin_permissions, []],
    [
      core_moderators_permissions,
      [
        {
          permissions: [],
          roleId: null,
          unrestricted: false,
          userId: MODERATOR_ID,
        },
      ],
    ],
    [
      core_sessions_known_devices,
      [PHONE, OFFICE, LAPTOP, TABLET].map(device => ({
        ipAddress: "203.0.113.7",
        userAgent: "node",
        ...device,
      })),
    ],
    [
      core_sessions,
      [
        session(TARGET_ID, PHONE.id),
        session(TARGET_ID, LAPTOP.id),
        session(TARGET_ID, TABLET.id, expired),
        session(OTHER_ID, TABLET.id),
        session(MODERATOR_ID, PHONE.id),
      ],
    ],
    [
      core_admin_sessions,
      [session(TARGET_ID, PHONE.id), session(TARGET_ID, OFFICE.id)],
    ],
  ]);

  await cache.setSystem(
    sessionCacheKey(`token-${TARGET_ID}-${PHONE.id}`, PHONE.id),
    {
      cached: true,
    },
  );
  await cache.setSystem(
    adminSessionCacheKey(`token-${TARGET_ID}-${OFFICE.id}`, OFFICE.id),
    { cached: true },
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    await next();
  });
  app.route(
    "/",
    buildModule({
      name: "users",
      pluginId: CONFIG_PLUGIN.pluginId,
      routes: [
        listUserDevicesAdminRoute,
        revokeUserDevicesAdminRoute,
        revokeUserDeviceAdminRoute,
      ],
    }).hono,
  );

  const sessionsOf = (userId: number) => ({
    admin: memory
      .rows(core_admin_sessions)
      .filter(row => row.userId === userId)
      .map(row => row.deviceId),
    user: memory
      .rows(core_sessions)
      .filter(row => row.userId === userId)
      .map(row => row.deviceId),
  });

  const isCached = async () => ({
    admin:
      (await cache.getSystem(
        adminSessionCacheKey(`token-${TARGET_ID}-${OFFICE.id}`, OFFICE.id),
      )) !== null,
    user:
      (await cache.getSystem(
        sessionCacheKey(`token-${TARGET_ID}-${PHONE.id}`, PHONE.id),
      )) !== null,
  });

  const request = async (path: string, method = "GET") =>
    await app.request(path, { method });

  return { isCached, request, sessionsOf };
};

describe("GET /admin/users/{id}/devices", () => {
  it("lists only the user's active devices, newest first, with session kinds", async () => {
    const h = await harness([CAN_VIEW]);

    const response = await h.request(`/${TARGET_ID}/devices`);

    expect(response.status).toBe(200);
    const { devices } = (await response.json()) as {
      devices: Record<string, unknown>[];
    };
    expect(
      devices.map(({ publicId, sessionKinds }) => ({ publicId, sessionKinds })),
    ).toEqual([
      { publicId: PHONE.publicId, sessionKinds: ["user", "admin"] },
      { publicId: OFFICE.publicId, sessionKinds: ["admin"] },
      { publicId: LAPTOP.publicId, sessionKinds: ["user"] },
    ]);
    expect(devices[0]).not.toHaveProperty("isCurrent");
  });

  it("returns 404 for an unknown user", async () => {
    const h = await harness([CAN_VIEW]);

    const response = await h.request("/404/devices");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  it("refuses a caller without users:can_view", async () => {
    const h = await harness([CAN_EDIT]);

    expect((await h.request(`/${TARGET_ID}/devices`)).status).toBe(403);
  });
});

describe("DELETE /admin/users/{id}/devices/{publicId}", () => {
  it("ends both session kinds on that device and drops their cache", async () => {
    const h = await harness([CAN_EDIT]);

    const response = await h.request(
      `/${TARGET_ID}/devices/${PHONE.publicId}`,
      "DELETE",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.sessionsOf(TARGET_ID)).toEqual({
      admin: [OFFICE.id],
      user: [LAPTOP.id, TABLET.id],
    });
    expect(h.sessionsOf(MODERATOR_ID).user).toEqual([PHONE.id]);
    expect((await h.isCached()).user).toBe(false);
  });

  it("returns 404 for a device the user has no session on", async () => {
    const h = await harness([CAN_EDIT]);

    const response = await h.request(`/${OTHER_ID}/devices/phone`, "DELETE");

    expect(response.status).toBe(404);
    expect(h.sessionsOf(MODERATOR_ID).user).toEqual([PHONE.id]);
  });

  it("returns 404 for an unknown device", async () => {
    const h = await harness([CAN_EDIT]);

    expect(
      (await h.request(`/${TARGET_ID}/devices/missing`, "DELETE")).status,
    ).toBe(404);
  });

  it("rejects a malformed device id", async () => {
    const h = await harness([CAN_EDIT]);

    expect(
      (await h.request(`/${TARGET_ID}/devices/bad%20id`, "DELETE")).status,
    ).toBe(400);
  });

  it("refuses a caller without users:can_edit", async () => {
    const h = await harness([CAN_VIEW]);

    const response = await h.request(
      `/${TARGET_ID}/devices/${PHONE.publicId}`,
      "DELETE",
    );

    expect(response.status).toBe(403);
    expect(h.sessionsOf(TARGET_ID).user).toContain(PHONE.id);
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness([CAN_EDIT]);

    const response = await h.request(
      `/${MODERATOR_ID}/devices/${PHONE.publicId}`,
      "DELETE",
    );

    expect(response.status).toBe(403);
    expect(h.sessionsOf(MODERATOR_ID).user).toEqual([PHONE.id]);
  });

  it("lets users:can_edit_admin revoke a staff target's device", async () => {
    const h = await harness([CAN_EDIT, CAN_EDIT_ADMIN]);

    const response = await h.request(
      `/${MODERATOR_ID}/devices/${PHONE.publicId}`,
      "DELETE",
    );

    expect(response.status).toBe(200);
    expect(h.sessionsOf(MODERATOR_ID).user).toEqual([]);
  });
});

describe("DELETE /admin/users/{id}/devices", () => {
  it("ends every session of the user and only that user", async () => {
    const h = await harness([CAN_EDIT]);

    const response = await h.request(`/${TARGET_ID}/devices`, "DELETE");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(h.sessionsOf(TARGET_ID)).toEqual({ admin: [], user: [] });
    expect(h.sessionsOf(OTHER_ID).user).toEqual([TABLET.id]);
    expect(await h.isCached()).toEqual({ admin: false, user: false });
  });

  it("returns 404 for an unknown user", async () => {
    const h = await harness([CAN_EDIT]);

    expect((await h.request("/404/devices", "DELETE")).status).toBe(404);
  });

  it("refuses a caller without users:can_edit", async () => {
    const h = await harness([CAN_VIEW]);

    expect((await h.request(`/${TARGET_ID}/devices`, "DELETE")).status).toBe(
      403,
    );
    expect(h.sessionsOf(TARGET_ID).admin).toHaveLength(2);
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness([CAN_EDIT]);

    expect((await h.request(`/${MODERATOR_ID}/devices`, "DELETE")).status).toBe(
      403,
    );
    expect(h.sessionsOf(MODERATOR_ID).user).toEqual([PHONE.id]);
  });
});
