// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { showUserAdminRoute } from "./show.route";

const ROOT_ROLE = 1;
const VIEWER_ROLE = 2;
const MEMBER_ROLE = 3;

const VIEWER = { email: "viewer@example.com", id: 1, roleId: VIEWER_ROLE };
const TARGET_ID = 7;

const CAN_VIEW: PermissionsStaffArgs = {
  module: "users",
  permission: "can_view",
  plugin: "@vitnode/core",
};

type TargetShape =
  | "admin"
  | "member"
  | "moderator"
  | "root via a secondary role";

const entryRow = (entry: Record<string, unknown>) => ({
  permissions: [],
  roleId: null,
  unrestricted: false,
  userId: null,
  ...entry,
});

const showTarget = async (target: TargetShape) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: [CAN_VIEW],
    userId: VIEWER.id,
  });

  const memory = createMemoryDb([
    [
      core_users,
      [
        VIEWER,
        {
          email: "target@example.com",
          id: TARGET_ID,
          name: "Target",
          nameCode: "target",
          roleId: MEMBER_ROLE,
        },
      ],
    ],
    [
      core_users_secondary_roles,
      target === "root via a secondary role"
        ? [{ roleId: ROOT_ROLE, userId: TARGET_ID }]
        : [],
    ],
    [
      core_roles,
      [
        { guest: false, id: ROOT_ROLE, root: true },
        { guest: false, id: VIEWER_ROLE, root: false },
        { guest: false, id: MEMBER_ROLE, root: false },
      ],
    ],
    [
      core_admin_permissions,
      [
        entryRow({ permissions: [CAN_VIEW], roleId: VIEWER_ROLE }),
        ...(target === "admin" ? [entryRow({ userId: TARGET_ID })] : []),
      ],
    ],
    [
      core_moderators_permissions,
      target === "moderator" ? [entryRow({ userId: TARGET_ID })] : [],
    ],
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: VIEWER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    await next();
  });
  app.openapi(showUserAdminRoute.route, showUserAdminRoute.handler);

  return await app.request(`/${TARGET_ID}`);
};

describe("GET /admin/users/{id} - staff flag", () => {
  it.each<TargetShape>(["moderator", "root via a secondary role", "admin"])(
    "reports a target who is %s as staff",
    async target => {
      const response = await showTarget(target);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        id: TARGET_ID,
        isStaff: true,
      });
    },
  );

  it("reports a plain member as not staff", async () => {
    const response = await showTarget("member");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: TARGET_ID,
      isStaff: false,
    });
  });
});
