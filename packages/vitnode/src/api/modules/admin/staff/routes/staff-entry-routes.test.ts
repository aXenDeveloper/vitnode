// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";
import type { buildRoute } from "@/api/lib/route";

import { normalizePermissionStaffModules } from "@/api/lib/permission-staff";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { createStaffAdminRoute } from "./create.route";
import { deleteStaffAdminRoute } from "./delete.route";
import { updatePermissionsStaffAdminRoute } from "./update-permissions.route";

const CORE = "@vitnode/core";

const permission = (module: string, name: string): PermissionsStaffArgs => ({
  module,
  permission: name,
  plugin: CORE,
});

const VIEW_ADMINS = permission("staff_admins", "can_view");
const CREATE_ADMINS = permission("staff_admins", "can_create");
const EDIT_ADMINS = permission("staff_admins", "can_edit");
const DELETE_ADMINS = permission("staff_admins", "can_delete");
const MANAGE_ADMINS = [VIEW_ADMINS, CREATE_ADMINS, EDIT_ADMINS, DELETE_ADMINS];
const VIEW_USERS = permission("users", "can_view");
const EDIT_MODERATORS = permission("staff_moderators", "can_edit");
const CREATE_MODERATORS = permission("staff_moderators", "can_create");
const DELETE_MODERATORS = permission("staff_moderators", "can_delete");
const MODERATE_WIDGETS = permission("widgets", "can_edit");
const MODERATE_USERS = permission("users", "can_edit");

const CATALOG = [
  {
    pluginId: CORE,
    admin: normalizePermissionStaffModules({
      staff_admins: [
        "can_view",
        { permission: "can_create", dependsOn: ["can_view"] },
        { permission: "can_edit", dependsOn: ["can_view"] },
        { permission: "can_delete", dependsOn: ["can_view"] },
      ],
      staff_moderators: [
        "can_view",
        { permission: "can_create", dependsOn: ["can_view"] },
        { permission: "can_edit", dependsOn: ["can_view"] },
        { permission: "can_delete", dependsOn: ["can_view"] },
      ],
      users: ["can_view"],
    }),
    moderator: normalizePermissionStaffModules({
      users: ["can_edit"],
      widgets: ["can_edit"],
    }),
  },
];

const CALLER = { id: 1, roleId: 10 };
const CALLER_SECONDARY_ROLE_ID = 11;
const TARGET_ROLE_ID = 20;

interface Entry {
  id: number;
  permissions: PermissionsStaffArgs[];
  protected: boolean;
  roleId: null | number;
  unrestricted: boolean;
  userId: null | number;
}

interface TargetRole {
  default: boolean;
  guest: boolean;
}

const ORDINARY_ROLE: TargetRole = { default: false, guest: false };

const entryFor = (overrides: Partial<Entry> = {}): Entry => ({
  id: 5,
  permissions: [],
  protected: false,
  roleId: TARGET_ROLE_ID,
  unrestricted: false,
  userId: null,
  ...overrides,
});

const tableByType = {
  admin: core_admin_permissions,
  moderator: core_moderators_permissions,
} as const;

const appFor = async (
  built: ReturnType<typeof buildRoute>,
  {
    entry,
    grants,
    role = ORDINARY_ROLE,
  }: {
    entry?: Entry;
    grants: Partial<
      Record<PermissionStaffType, PermissionsStaffArgs[] | StaffPermissionSet>
    >;
    role?: null | TargetRole;
  },
) => {
  const cache = createTestCache();
  for (const [type, permissions] of Object.entries(grants)) {
    await grantStaffPermissions(cache, {
      permissions,
      type: type as PermissionStaffType,
      userId: CALLER.id,
    });
  }
  const memory = createMemoryDb([
    [
      core_roles,
      [
        { ...ORDINARY_ROLE, id: CALLER.roleId, root: false },
        { ...ORDINARY_ROLE, id: CALLER_SECONDARY_ROLE_ID, root: false },
        ...(role ? [{ ...role, id: TARGET_ROLE_ID, root: false }] : []),
      ],
    ],
    [
      core_users_secondary_roles,
      [{ roleId: CALLER_SECONDARY_ROLE_ID, userId: CALLER.id }],
    ],
    [core_admin_permissions, entry ? [entry] : []],
    [core_moderators_permissions, entry ? [entry] : []],
  ]);
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("admin", { user: CALLER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("core", {
      permissionStaff: CATALOG,
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(built.route, built.handler);

  const storedEntries = (type: PermissionStaffType = "admin") =>
    memory.rows(tableByType[type]);

  return { app, storedEntries };
};

const patch = async (
  app: OpenAPIHono,
  body: { permissions: PermissionsStaffArgs[]; unrestricted: boolean },
  type: PermissionStaffType = "admin",
) =>
  await app.request(`/entry/${type}/5`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

const post = async (
  app: OpenAPIHono,
  body: { roleId?: number; userId?: number },
  type: PermissionStaffType = "admin",
) =>
  await app.request(`/entry/${type}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

describe("updating a staff entry", () => {
  it("refuses unrestricted access from a non-root administrator", async () => {
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: entryFor(),
        grants: { admin: MANAGE_ADMINS },
      },
    );

    const res = await patch(app, { permissions: [], unrestricted: true });

    expect(res.status).toBe(403);
    expect(storedEntries()).toEqual([entryFor()]);
  });

  it("lets a root administrator grant unrestricted access", async () => {
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: entryFor({ permissions: [VIEW_ADMINS] }),
        grants: { admin: ROOT_STAFF_PERMISSIONS },
      },
    );

    const res = await patch(app, { permissions: [], unrestricted: true });

    expect(res.status).toBe(200);
    expect(storedEntries()).toEqual([
      expect.objectContaining({
        id: entryFor().id,
        permissions: [],
        unrestricted: true,
      }),
    ]);
  });

  it("refuses a permission the caller does not hold", async () => {
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: entryFor(),
        grants: { admin: MANAGE_ADMINS },
      },
    );

    const res = await patch(app, {
      permissions: [VIEW_ADMINS, VIEW_USERS],
      unrestricted: false,
    });

    expect(res.status).toBe(403);
    expect(storedEntries()).toEqual([entryFor()]);
  });

  it("grants a subset of the caller's own permissions", async () => {
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: entryFor(),
        grants: { admin: MANAGE_ADMINS },
      },
    );

    const res = await patch(app, {
      permissions: [VIEW_ADMINS, CREATE_ADMINS],
      unrestricted: false,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      permissions: [VIEW_ADMINS, CREATE_ADMINS],
      unrestricted: false,
    });
    expect(storedEntries()).toEqual([
      expect.objectContaining({
        permissions: [VIEW_ADMINS, CREATE_ADMINS],
        unrestricted: false,
      }),
    ]);
  });

  it("keeps a permission the entry already had when the caller holds it", async () => {
    const { app } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor({ permissions: [VIEW_ADMINS] }),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await patch(app, {
      permissions: [VIEW_ADMINS, CREATE_ADMINS],
      unrestricted: false,
    });

    expect(res.status).toBe(200);
  });

  it("refuses to demote an unrestricted entry from a non-root administrator", async () => {
    const target = entryFor({ unrestricted: true });
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: target,
        grants: { admin: MANAGE_ADMINS },
      },
    );

    const res = await patch(app, { permissions: [], unrestricted: false });

    expect(res.status).toBe(403);
    expect(storedEntries()).toEqual([target]);
  });

  it("refuses to edit an entry holding a permission the caller lacks", async () => {
    const target = entryFor({ permissions: [VIEW_USERS] });
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: target,
        grants: { admin: MANAGE_ADMINS },
      },
    );

    const res = await patch(app, { permissions: [], unrestricted: false });

    expect(res.status).toBe(403);
    expect(storedEntries()).toEqual([target]);
  });

  it("lets a root administrator demote an unrestricted entry", async () => {
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: entryFor({ unrestricted: true }),
        grants: { admin: ROOT_STAFF_PERMISSIONS },
      },
    );

    const res = await patch(app, {
      permissions: [VIEW_ADMINS],
      unrestricted: false,
    });

    expect(res.status).toBe(200);
    expect(storedEntries()).toEqual([
      expect.objectContaining({
        permissions: [VIEW_ADMINS],
        unrestricted: false,
      }),
    ]);
  });

  it("refuses to edit a moderator entry holding a moderator permission the caller lacks", async () => {
    const target = entryFor({ permissions: [MODERATE_WIDGETS] });
    const { app, storedEntries } = await appFor(
      updatePermissionsStaffAdminRoute,
      {
        entry: target,
        grants: { admin: [EDIT_MODERATORS], moderator: [MODERATE_USERS] },
      },
    );

    const res = await patch(
      app,
      { permissions: [], unrestricted: false },
      "moderator",
    );

    expect(res.status).toBe(403);
    expect(storedEntries("moderator")).toEqual([target]);
  });

  it("measures a moderator grant against the caller's moderator permissions", async () => {
    const withoutWidgets = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: { admin: [EDIT_MODERATORS], moderator: [MODERATE_USERS] },
    });
    const withWidgets = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: {
        admin: [EDIT_MODERATORS],
        moderator: [MODERATE_USERS, MODERATE_WIDGETS],
      },
    });
    const body = {
      permissions: [MODERATE_WIDGETS],
      unrestricted: false,
    };

    expect((await patch(withoutWidgets.app, body, "moderator")).status).toBe(
      403,
    );
    expect((await patch(withWidgets.app, body, "moderator")).status).toBe(200);
  });

  it.each([
    ["default", { default: true, guest: false }],
    ["guest", { default: false, guest: true }],
  ])(
    "refuses to grant anything to an entry for the %s role",
    async (_label, role) => {
      const { app, storedEntries } = await appFor(
        updatePermissionsStaffAdminRoute,
        {
          entry: entryFor(),
          grants: { admin: ROOT_STAFF_PERMISSIONS },
          role,
        },
      );

      const res = await patch(app, { permissions: [], unrestricted: true });

      expect(res.status).toBe(400);
      expect(storedEntries()).toEqual([entryFor()]);
    },
  );
});

const remove = async (app: OpenAPIHono, type: PermissionStaffType = "admin") =>
  await app.request(`/entry/${type}/5`, { method: "DELETE" });

describe("removing a staff entry", () => {
  it("removes an entry within the caller's own permissions", async () => {
    const { app, storedEntries } = await appFor(deleteStaffAdminRoute, {
      entry: entryFor({ permissions: [VIEW_ADMINS] }),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await remove(app);

    expect(res.status).toBe(200);
    expect(storedEntries()).toEqual([]);
  });

  it.each([
    ["an unrestricted entry", entryFor({ unrestricted: true })],
    [
      "an entry holding a permission the caller lacks",
      entryFor({ permissions: [VIEW_USERS] }),
    ],
  ])(
    "refuses to remove %s from a non-root administrator",
    async (_label, target) => {
      const { app, storedEntries } = await appFor(deleteStaffAdminRoute, {
        entry: target,
        grants: { admin: MANAGE_ADMINS },
      });

      const res = await remove(app);

      expect(res.status).toBe(403);
      expect(storedEntries()).toEqual([target]);
    },
  );

  it("lets a root administrator remove an unrestricted entry", async () => {
    const { app, storedEntries } = await appFor(deleteStaffAdminRoute, {
      entry: entryFor({ unrestricted: true }),
      grants: { admin: ROOT_STAFF_PERMISSIONS },
    });

    const res = await remove(app);

    expect(res.status).toBe(200);
    expect(storedEntries()).toEqual([]);
  });

  it("measures a moderator entry against the caller's moderator permissions", async () => {
    const target = entryFor({ permissions: [MODERATE_WIDGETS] });
    const without = await appFor(deleteStaffAdminRoute, {
      entry: target,
      grants: { admin: [DELETE_MODERATORS], moderator: [MODERATE_USERS] },
    });
    const withWidgets = await appFor(deleteStaffAdminRoute, {
      entry: target,
      grants: {
        admin: [DELETE_MODERATORS],
        moderator: [MODERATE_USERS, MODERATE_WIDGETS],
      },
    });

    expect((await remove(without.app, "moderator")).status).toBe(403);
    expect(without.storedEntries("moderator")).toEqual([target]);
    expect((await remove(withWidgets.app, "moderator")).status).toBe(200);
    expect(withWidgets.storedEntries("moderator")).toEqual([]);
  });

  it("refuses to remove the caller's own role entry", async () => {
    const { app, storedEntries } = await appFor(deleteStaffAdminRoute, {
      entry: entryFor({ roleId: CALLER.roleId }),
      grants: { admin: ROOT_STAFF_PERMISSIONS },
    });

    expect((await remove(app)).status).toBe(403);
    expect(storedEntries()).toHaveLength(1);
  });
});

describe("creating a staff entry", () => {
  it("creates an entry for an ordinary role", async () => {
    const { app, storedEntries } = await appFor(createStaffAdminRoute, {
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await post(app, { roleId: TARGET_ROLE_ID });

    expect(res.status).toBe(201);
    const stored = storedEntries();
    expect(stored).toEqual([
      expect.objectContaining({ roleId: TARGET_ROLE_ID, userId: null }),
    ]);
    expect(await res.json()).toEqual({ id: stored[0]?.id });
  });

  it.each([
    ["default", { default: true, guest: false }],
    ["guest", { default: false, guest: true }],
  ])("refuses the %s role", async (_label, role) => {
    const { app, storedEntries } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
      role,
    });

    const res = await post(app, { roleId: TARGET_ROLE_ID });

    expect(res.status).toBe(400);
    expect(storedEntries()).toEqual([]);
  });

  it("refuses a role that does not exist", async () => {
    const { app, storedEntries } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
      role: null,
    });

    const res = await post(app, { roleId: TARGET_ROLE_ID });

    expect(res.status).toBe(404);
    expect(storedEntries()).toEqual([]);
  });

  it.each([
    ["the caller's own user", { userId: CALLER.id }],
    ["the caller's primary role", { roleId: CALLER.roleId }],
    ["the caller's secondary role", { roleId: CALLER_SECONDARY_ROLE_ID }],
  ])("refuses an entry for %s", async (_label, body) => {
    const { app, storedEntries } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
    });

    const res = await post(app, body);

    expect(res.status).toBe(403);
    expect(storedEntries()).toEqual([]);
  });

  it("refuses a moderator entry for the caller's own role", async () => {
    const { app, storedEntries } = await appFor(createStaffAdminRoute, {
      grants: { admin: [CREATE_MODERATORS] },
    });

    expect(
      (await post(app, { roleId: CALLER.roleId }, "moderator")).status,
    ).toBe(403);
    expect(storedEntries("moderator")).toEqual([]);
  });
});
