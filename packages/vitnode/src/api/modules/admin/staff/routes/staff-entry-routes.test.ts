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
import type { StubQuery } from "@/tests/query-stub";

import { normalizePermissionStaffModules } from "@/api/lib/permission-staff";
import { core_admin_permissions } from "@/database/admins";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createQueryStub } from "@/tests/query-stub";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { createStaffAdminRoute } from "./create.route";
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
const MANAGE_ADMINS = [VIEW_ADMINS, CREATE_ADMINS, EDIT_ADMINS];
const VIEW_USERS = permission("users", "can_view");
const EDIT_MODERATORS = permission("staff_moderators", "can_edit");
const CREATE_MODERATORS = permission("staff_moderators", "can_create");
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
      ],
      staff_moderators: [
        "can_view",
        { permission: "can_create", dependsOn: ["can_view"] },
        { permission: "can_edit", dependsOn: ["can_view"] },
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
  roleId: 20,
  unrestricted: false,
  userId: null,
  ...overrides,
});

const answerFor =
  ({ entry, role }: { entry?: Entry; role: null | TargetRole }) =>
  (query: StubQuery): unknown[] => {
    if (query.table === core_users_secondary_roles) {
      return [{ roleId: CALLER_SECONDARY_ROLE_ID }];
    }
    if (query.table === core_roles) return role ? [role] : [];
    if (query.kind === "insert") return [{ id: 77 }];
    if (query.kind === "update") return entry ? [{ id: entry.id }] : [];
    if (
      query.table === core_admin_permissions ||
      query.table === core_moderators_permissions
    ) {
      return entry ? [entry] : [];
    }

    throw new Error("unexpected query");
  };

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
  const { db, executed } = createQueryStub(answerFor({ entry, role }));
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("admin", { user: CALLER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db as unknown as Context["var"]["db"]);
    c.set("core", {
      permissionStaff: CATALOG,
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(built.route, built.handler);

  const updates = () => executed.filter(query => query.kind === "update");
  const inserts = () => executed.filter(query => query.kind === "insert");

  return { app, inserts, updates };
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
    const { app, updates } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await patch(app, { permissions: [], unrestricted: true });

    expect(res.status).toBe(403);
    expect(updates()).toHaveLength(0);
  });

  it("lets a root administrator grant unrestricted access", async () => {
    const { app, updates } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: { admin: ROOT_STAFF_PERMISSIONS },
    });

    const res = await patch(app, { permissions: [], unrestricted: true });

    expect(res.status).toBe(200);
    expect(updates()[0]?.values).toEqual({
      permissions: [],
      unrestricted: true,
    });
  });

  it("refuses a permission the caller does not hold", async () => {
    const { app, updates } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await patch(app, {
      permissions: [VIEW_ADMINS, VIEW_USERS],
      unrestricted: false,
    });

    expect(res.status).toBe(403);
    expect(updates()).toHaveLength(0);
  });

  it("grants a subset of the caller's own permissions", async () => {
    const { app } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor(),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await patch(app, {
      permissions: [VIEW_ADMINS, CREATE_ADMINS],
      unrestricted: false,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      permissions: [VIEW_ADMINS, CREATE_ADMINS],
      unrestricted: false,
    });
  });

  it("keeps a permission the entry already had", async () => {
    const { app } = await appFor(updatePermissionsStaffAdminRoute, {
      entry: entryFor({ permissions: [VIEW_USERS] }),
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await patch(app, {
      permissions: [VIEW_USERS, VIEW_ADMINS],
      unrestricted: false,
    });

    expect(res.status).toBe(200);
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
      const { app, updates } = await appFor(updatePermissionsStaffAdminRoute, {
        entry: entryFor(),
        grants: { admin: ROOT_STAFF_PERMISSIONS },
        role,
      });

      const res = await patch(app, { permissions: [], unrestricted: true });

      expect(res.status).toBe(400);
      expect(updates()).toHaveLength(0);
    },
  );
});

describe("creating a staff entry", () => {
  it("creates an entry for an ordinary role", async () => {
    const { app, inserts } = await appFor(createStaffAdminRoute, {
      grants: { admin: MANAGE_ADMINS },
    });

    const res = await post(app, { roleId: 20 });

    expect(res.status).toBe(201);
    expect(inserts()).toHaveLength(1);
  });

  it.each([
    ["default", { default: true, guest: false }],
    ["guest", { default: false, guest: true }],
  ])("refuses the %s role", async (_label, role) => {
    const { app, inserts } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
      role,
    });

    const res = await post(app, { roleId: 20 });

    expect(res.status).toBe(400);
    expect(inserts()).toHaveLength(0);
  });

  it("refuses a role that does not exist", async () => {
    const { app, inserts } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
      role: null,
    });

    const res = await post(app, { roleId: 20 });

    expect(res.status).toBe(404);
    expect(inserts()).toHaveLength(0);
  });

  it.each([
    ["the caller's own user", { userId: CALLER.id }],
    ["the caller's primary role", { roleId: CALLER.roleId }],
    ["the caller's secondary role", { roleId: CALLER_SECONDARY_ROLE_ID }],
  ])("refuses an entry for %s", async (_label, body) => {
    const { app, inserts } = await appFor(createStaffAdminRoute, {
      grants: { admin: ROOT_STAFF_PERMISSIONS },
    });

    const res = await post(app, body);

    expect(res.status).toBe(403);
    expect(inserts()).toHaveLength(0);
  });

  it("refuses a moderator entry for the caller's own role", async () => {
    const { app } = await appFor(createStaffAdminRoute, {
      grants: { admin: [CREATE_MODERATORS] },
    });

    expect(
      (await post(app, { roleId: CALLER.roleId }, "moderator")).status,
    ).toBe(403);
  });
});
