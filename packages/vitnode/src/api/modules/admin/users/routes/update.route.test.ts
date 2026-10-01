// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { updateUserAdminRoute } from "./update.route";

const ROOT_ROLE = 1;
const EDITOR_ROLE = 2;
const MEMBER_ROLE = 3;
const PLUGINS_ROLE = 9;

const EDITOR = { email: "editor@example.com", id: 1, roleId: EDITOR_ROLE };
const TARGET_ID = 7;

const permission = (name: string, module = "users"): PermissionsStaffArgs => ({
  module,
  permission: name,
  plugin: "@vitnode/core",
});

const CAN_EDIT = permission("can_edit");
const CAN_EDIT_ADMIN = permission("can_edit_admin");

type TargetShape = "member" | "moderator" | "root via a secondary role";

const entryRow = (entry: Record<string, unknown>) => ({
  permissions: [],
  roleId: null,
  unrestricted: false,
  userId: null,
  ...entry,
});

const harness = async ({
  editor,
  target = "member",
}: {
  editor: PermissionsStaffArgs[] | typeof ROOT_STAFF_PERMISSIONS;
  target?: TargetShape;
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
        { guest: false, id: EDITOR_ROLE, root: false },
        { guest: false, id: MEMBER_ROLE, root: false },
        { guest: false, id: PLUGINS_ROLE, root: false },
      ],
    ],
    [
      core_admin_permissions,
      [
        entryRow({
          permissions: [CAN_EDIT, CAN_EDIT_ADMIN],
          roleId: EDITOR_ROLE,
        }),
        entryRow({
          permissions: [permission("can_manage", "plugins")],
          roleId: PLUGINS_ROLE,
        }),
      ],
    ],
    [
      core_moderators_permissions,
      target === "moderator" ? [entryRow({ userId: TARGET_ID })] : [],
    ],
  ]);

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: EDITOR } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("events", {
      emit: vi.fn(async () => Promise.resolve()),
    } as unknown as Context["var"]["events"]);
    await next();
  });
  app.openapi(updateUserAdminRoute.route, updateUserAdminRoute.handler);

  const patch = async (userId: number, body: Record<string, unknown>) =>
    await app.request(`/${userId}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });

  const userRow = (userId: number) =>
    memory.rows(core_users).find(row => row.id === userId);

  const secondaryRoleIdsOf = (userId: number) =>
    memory
      .rows(core_users_secondary_roles)
      .filter(row => row.userId === userId)
      .map(row => row.roleId);

  return { patch, secondaryRoleIdsOf, userRow };
};

const NEW_EMAIL = { email: "attacker@example.com" };

describe("PATCH /admin/users/{id} - staff targets", () => {
  it.each<TargetShape>(["root via a secondary role", "moderator"])(
    "refuses an email change of a target who is %s without users:can_edit_admin",
    async target => {
      const h = await harness({ editor: [CAN_EDIT], target });

      const response = await h.patch(TARGET_ID, NEW_EMAIL);

      expect(response.status).toBe(403);
      expect(h.userRow(TARGET_ID)?.email).toBe("target@example.com");
    },
  );

  it.each<TargetShape>(["root via a secondary role", "moderator"])(
    "changes the email of a target who is %s with users:can_edit_admin",
    async target => {
      const h = await harness({ editor: [CAN_EDIT, CAN_EDIT_ADMIN], target });

      const response = await h.patch(TARGET_ID, NEW_EMAIL);

      expect(response.status).toBe(200);
      expect(h.userRow(TARGET_ID)?.email).toBe(NEW_EMAIL.email);
    },
  );

  it("lets users:can_edit alone change a member's email", async () => {
    const h = await harness({ editor: [CAN_EDIT] });

    expect((await h.patch(TARGET_ID, NEW_EMAIL)).status).toBe(200);
  });

  it("refuses stripping the secondary roles of a root target without users:can_edit_admin", async () => {
    const h = await harness({
      editor: [CAN_EDIT],
      target: "root via a secondary role",
    });

    const response = await h.patch(TARGET_ID, { secondaryRoleIds: [] });

    expect(response.status).toBe(403);
    expect(h.secondaryRoleIdsOf(TARGET_ID)).toEqual([ROOT_ROLE]);
  });
});

describe("PATCH /admin/users/{id} - privilege ceiling", () => {
  const ELEVATED = [CAN_EDIT, CAN_EDIT_ADMIN];

  it.each([
    ["as the primary role of another user", TARGET_ID, { roleId: ROOT_ROLE }],
    [
      "as a secondary role of another user",
      TARGET_ID,
      { secondaryRoleIds: [ROOT_ROLE] },
    ],
    [
      "as a secondary role of themselves",
      EDITOR.id,
      { secondaryRoleIds: [ROOT_ROLE] },
    ],
    ["as the primary role of themselves", EDITOR.id, { roleId: ROOT_ROLE }],
  ])(
    "refuses a non-root admin assigning the root role %s",
    async (_label, userId, body) => {
      const h = await harness({ editor: ELEVATED });

      const response = await h.patch(userId, body);

      expect(response.status).toBe(403);
      expect(h.userRow(userId)?.roleId).not.toBe(ROOT_ROLE);
      expect(h.secondaryRoleIdsOf(userId)).not.toContain(ROOT_ROLE);
    },
  );

  it("lets a root admin assign the root role", async () => {
    const h = await harness({ editor: ROOT_STAFF_PERMISSIONS });

    const response = await h.patch(TARGET_ID, {
      secondaryRoleIds: [ROOT_ROLE],
    });

    expect(response.status).toBe(200);
    expect(h.secondaryRoleIdsOf(TARGET_ID)).toEqual([ROOT_ROLE]);
  });

  it("refuses a role carrying an admin permission the editor lacks", async () => {
    const h = await harness({ editor: ELEVATED });

    const response = await h.patch(TARGET_ID, { roleId: PLUGINS_ROLE });

    expect(response.status).toBe(403);
    expect(h.userRow(TARGET_ID)?.roleId).toBe(MEMBER_ROLE);
  });

  it("allows a role whose permissions the editor holds", async () => {
    const h = await harness({ editor: ELEVATED });

    const response = await h.patch(TARGET_ID, { roleId: EDITOR_ROLE });

    expect(response.status).toBe(200);
    expect(h.userRow(TARGET_ID)?.roleId).toBe(EDITOR_ROLE);
  });
});
