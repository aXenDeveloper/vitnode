// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { PasswordModel } from "@/api/models/password";
import {
  adminSessionCacheKey,
  sessionCacheKey,
} from "@/api/models/session-cache";
import { core_admin_sessions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_sessions } from "@/database/sessions";
import { core_users } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { setPasswordUserAdminRoute } from "./password.route";

const EDITOR = { email: "editor@example.com", id: 1, roleId: 2 };
const TARGET_ID = 7;
const OTHER_ID = 8;
const OLD_HASH = "old-salt:old-key";
const NEW_PASSWORD = "Sup3rSecret!";

const permission = (name: string): PermissionsStaffArgs => ({
  module: "users",
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_EDIT = permission("can_edit");

const session = (id: number, userId: number, deviceId: number) => ({
  deviceId,
  expiresAt: new Date(),
  id,
  token: `token-${id}`,
  userId,
});

const harness = async ({
  editor,
  targetIsModerator = false,
}: {
  editor: PermissionsStaffArgs[];
  targetIsModerator?: boolean;
}) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: editor,
    userId: EDITOR.id,
  });

  const memory = createMemoryDb([
    [
      core_users,
      [
        EDITOR,
        { id: TARGET_ID, password: OLD_HASH, roleId: 3 },
        { id: OTHER_ID, password: OLD_HASH, roleId: 3 },
      ],
    ],
    [
      core_sessions,
      [
        session(1, TARGET_ID, 10),
        session(2, TARGET_ID, 11),
        session(3, OTHER_ID, 12),
      ],
    ],
    [core_admin_sessions, [session(4, TARGET_ID, 10)]],
    [
      core_moderators_permissions,
      targetIsModerator
        ? [
            {
              permissions: [],
              roleId: null,
              unrestricted: false,
              userId: TARGET_ID,
            },
          ]
        : [],
    ],
  ]);

  await Promise.all([
    cache.setSystem(sessionCacheKey("token-1", 10), { id: TARGET_ID }),
    cache.setSystem(adminSessionCacheKey("token-4", 10), { id: TARGET_ID }),
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    await next();
  });
  app.openapi(
    setPasswordUserAdminRoute.route,
    setPasswordUserAdminRoute.handler,
  );

  const put = async (userId: number | string, password: string) =>
    await app.request(`/${userId}/password`, {
      body: JSON.stringify({ password }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  const storedHash = (userId: number) =>
    memory.rows(core_users).find(row => row.id === userId)?.password;

  const sessionUserIds = () =>
    memory.rows(core_sessions).map(row => row.userId);

  const adminSessionUserIds = () =>
    memory.rows(core_admin_sessions).map(row => row.userId);

  return { adminSessionUserIds, cache, put, sessionUserIds, storedHash };
};

describe("PUT /admin/users/{id}/password", () => {
  it("stores a hash that verifies against the new password", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.put(TARGET_ID, NEW_PASSWORD);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const stored = h.storedHash(TARGET_ID);
    expect(typeof stored).toBe("string");
    expect(stored).not.toBe(NEW_PASSWORD);
    expect(
      await new PasswordModel().verifyPassword(NEW_PASSWORD, String(stored)),
    ).toBe(true);
    expect(h.storedHash(OTHER_ID)).toBe(OLD_HASH);
  });

  it("signs the member out of every device and drops their cached sessions", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    await h.put(TARGET_ID, NEW_PASSWORD);

    expect(h.sessionUserIds()).toEqual([OTHER_ID]);
    expect(h.adminSessionUserIds()).toEqual([]);
    expect(await h.cache.getSystem(sessionCacheKey("token-1", 10))).toBeNull();
    expect(
      await h.cache.getSystem(adminSessionCacheKey("token-4", 10)),
    ).toBeNull();
  });

  it("refuses an editor without users:can_edit", async () => {
    const h = await harness({ editor: [permission("can_view")] });

    const response = await h.put(TARGET_ID, NEW_PASSWORD);

    expect(response.status).toBe(403);
    expect(h.storedHash(TARGET_ID)).toBe(OLD_HASH);
    expect(h.sessionUserIds()).toHaveLength(3);
  });

  it("refuses a staff target without users:can_edit_admin", async () => {
    const h = await harness({ editor: [CAN_EDIT], targetIsModerator: true });

    const response = await h.put(TARGET_ID, NEW_PASSWORD);

    expect(response.status).toBe(403);
    expect(h.storedHash(TARGET_ID)).toBe(OLD_HASH);
  });

  it.each([404, "not-a-number"])(
    "answers 404 for the unknown user %s",
    async userId => {
      const h = await harness({ editor: [CAN_EDIT] });

      const response = await h.put(userId, NEW_PASSWORD);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "User not found" });
    },
  );

  it("refuses a password shorter than eight characters", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    const response = await h.put(TARGET_ID, "short");

    expect(response.status).toBe(400);
    expect(h.storedHash(TARGET_ID)).toBe(OLD_HASH);
  });
});
