// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import {
  adminSessionCacheKey,
  sessionCacheKey,
} from "@/api/models/session-cache";
import { core_admin_sessions } from "@/database/admins";
import { core_roles } from "@/database/roles";
import { core_sessions } from "@/database/sessions";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { deleteRoleAdminRoute } from "./delete.route";

const MEMBER_ROLE = 3;
const DOOMED_ROLE = 5;

const CALLER = { email: "root@example.com", id: 1, roleId: MEMBER_ROLE };
const PRIMARY_HOLDER = 7;
const SECONDARY_HOLDER = 8;
const BYSTANDER = 9;

const session = (userId: number) => ({
  deviceId: userId * 10,
  token: `token-${userId}`,
  userId,
});

const userKey = (userId: number) =>
  sessionCacheKey(session(userId).token, session(userId).deviceId);

const adminKey = (userId: number) =>
  adminSessionCacheKey(session(userId).token, session(userId).deviceId);

const harness = async () => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: ROOT_STAFF_PERMISSIONS,
    userId: CALLER.id,
  });

  for (const userId of [PRIMARY_HOLDER, SECONDARY_HOLDER, BYSTANDER]) {
    await cache.setSystem(userKey(userId), { id: userId }, 60);
  }
  await cache.setSystem(adminKey(SECONDARY_HOLDER), { id: SECONDARY_HOLDER });

  const memory = createMemoryDb([
    [
      core_roles,
      [
        { default: true, guest: false, id: MEMBER_ROLE, root: false },
        { default: false, guest: false, id: DOOMED_ROLE, root: false },
      ],
    ],
    [
      core_users,
      [
        CALLER,
        { id: PRIMARY_HOLDER, roleId: DOOMED_ROLE },
        { id: SECONDARY_HOLDER, roleId: MEMBER_ROLE },
        { id: BYSTANDER, roleId: MEMBER_ROLE },
      ],
    ],
    [
      core_users_secondary_roles,
      [{ roleId: DOOMED_ROLE, userId: SECONDARY_HOLDER }],
    ],
    [
      core_sessions,
      [session(PRIMARY_HOLDER), session(SECONDARY_HOLDER), session(BYSTANDER)],
    ],
    [core_admin_sessions, [session(SECONDARY_HOLDER)]],
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: CALLER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: vi.fn(async () => Promise.resolve()),
    } as unknown as Context["var"]["events"]);
    await next();
  });
  app.openapi(deleteRoleAdminRoute.route, deleteRoleAdminRoute.handler);

  const remove = async () =>
    await app.request(`/${DOOMED_ROLE}?moveToRoleId=${MEMBER_ROLE}`, {
      method: "DELETE",
    });

  return { cache, memory, remove };
};

describe("DELETE /admin/roles/{id} - session caches", () => {
  it("drops the cached sessions of primary and secondary holders of the deleted role", async () => {
    const h = await harness();

    const response = await h.remove();

    expect(response.status).toBe(200);
    expect(await h.cache.getSystem(userKey(PRIMARY_HOLDER))).toBeNull();
    expect(await h.cache.getSystem(userKey(SECONDARY_HOLDER))).toBeNull();
    expect(await h.cache.getSystem(adminKey(SECONDARY_HOLDER))).toBeNull();
  });

  it("keeps the cached sessions of users who never held the role", async () => {
    const h = await harness();

    await h.remove();

    expect(await h.cache.getSystem(userKey(BYSTANDER))).toEqual({
      id: BYSTANDER,
    });
  });

  it("moves primary holders to the fallback role", async () => {
    const h = await harness();

    await h.remove();

    expect(
      h.memory.rows(core_users).find(row => row.id === PRIMARY_HOLDER)?.roleId,
    ).toBe(MEMBER_ROLE);
    expect(h.memory.rows(core_roles).some(row => row.id === DOOMED_ROLE)).toBe(
      false,
    );
  });
});
