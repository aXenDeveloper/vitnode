// @vitest-environment node
import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";
import type { StubQuery } from "@/tests/query-stub";

import { core_admin_permissions } from "@/database/admins";
import { core_languages_words } from "@/database/languages";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users, core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createQueryStub } from "@/tests/query-stub";
import { grantStaffPermissions } from "@/tests/staff-permissions";

import { listRolesAdminRoute } from "./list.route";

const ADMIN = { id: 1, roleId: 1 };

const permission = (module: string, name: string): PermissionsStaffArgs => ({
  module,
  permission: name,
  plugin: "@vitnode/core",
});

const roleRow = (id: number, root = false) => ({
  allowEditPersonalInfo: true,
  allowUploadAvatar: true,
  allowUploadCover: true,
  allowUploadFiles: false,
  color: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  default: false,
  guest: false,
  id,
  maxAvatarSize: 2048,
  maxCoverSize: 5120,
  maxStorageForSubmit: null,
  prefix: null,
  protected: false,
  root,
  totalMaxStorage: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

const ROOT_ROLE = 1;
const MODERATOR_ROLE = 2;
const MEMBER_ROLE = 3;

const answer = (query: StubQuery): unknown[] => {
  if (query.table === core_roles) {
    if (query.selection && "count" in query.selection) return [{ count: 3 }];

    return [
      roleRow(MEMBER_ROLE),
      roleRow(MODERATOR_ROLE),
      roleRow(ROOT_ROLE, true),
    ];
  }
  if (query.table === core_languages_words) return [];
  if (query.table === core_users) {
    return [
      { roleId: MEMBER_ROLE, total: 4 },
      { roleId: ROOT_ROLE, total: 1 },
    ];
  }
  if (query.table === core_users_secondary_roles) {
    return [
      { roleId: MEMBER_ROLE, total: 2 },
      { roleId: MODERATOR_ROLE, total: 3 },
    ];
  }
  if (query.table === core_admin_permissions) return [];
  if (query.table === core_moderators_permissions) {
    return [{ roleId: MODERATOR_ROLE }];
  }

  throw new Error("unexpected query");
};

const list = async (permissions: PermissionsStaffArgs[]) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, { permissions, userId: ADMIN.id });
  const { db } = createQueryStub(answer);
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("admin", { user: ADMIN } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", db as unknown as Context["var"]["db"]);
    await next();
  });
  app.openapi(listRolesAdminRoute.route, listRolesAdminRoute.handler);

  return await app.request("/list?orderBy=id&order=desc");
};

interface ListedRole {
  grantsAdmin: boolean;
  id: number;
  usersCount: number;
}

const edgesOf = async (res: Response): Promise<ListedRole[]> => {
  const body = (await res.json()) as { edges: ListedRole[] };

  return body.edges;
};

describe("roles list", () => {
  it("refuses an administrator who cannot read roles anywhere", async () => {
    const res = await list([
      permission("roles", "can_create"),
      permission("users", "can_create"),
      permission("staff_admins", "can_view"),
    ]);

    expect(res.status).toBe(403);
  });

  it.each([
    ["the roles screen", permission("roles", "can_view")],
    ["the users screens", permission("users", "can_view")],
    ["creating an admin entry", permission("staff_admins", "can_create")],
    [
      "creating a moderator entry",
      permission("staff_moderators", "can_create"),
    ],
  ])("serves the role picker for %s", async (_label, granted) => {
    const res = await list([granted]);

    expect(res.status).toBe(200);
  });

  it("counts secondary holders alongside primary ones", async () => {
    const edges = await edgesOf(await list([permission("roles", "can_view")]));

    expect(
      Object.fromEntries(edges.map(role => [role.id, role.usersCount])),
    ).toEqual({ [MEMBER_ROLE]: 6, [MODERATOR_ROLE]: 3, [ROOT_ROLE]: 1 });
  });

  it("marks root and moderator roles as granting admin", async () => {
    const edges = await edgesOf(await list([permission("roles", "can_view")]));

    expect(
      Object.fromEntries(edges.map(role => [role.id, role.grantsAdmin])),
    ).toEqual({
      [MEMBER_ROLE]: false,
      [MODERATOR_ROLE]: true,
      [ROOT_ROLE]: true,
    });
  });
});
