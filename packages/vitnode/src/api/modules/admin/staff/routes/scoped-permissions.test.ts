import type { Context } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type {
  PermissionsStaffArgs,
  PermissionStaffScope,
  StaffPermissionSet,
} from "@/api/lib/permission-staff";

import { defineModerationScope } from "@/api/lib/moderation/scopes";
import { normalizePermissionStaffModules } from "@/api/lib/permission-staff";
import { core_moderators_permissions } from "@/database/moderators";
import { core_roles } from "@/database/roles";
import { core_users_secondary_roles } from "@/database/users";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";
import {
  grantStaffPermissions,
  ROOT_STAFF_PERMISSIONS,
} from "@/tests/staff-permissions";

import { updatePermissionsStaffAdminRoute } from "./update-permissions.route";

const FORUM = "@vitnode/forum";
const FAMILY = "forum.section";
const SECTION_A = "10";
const SECTION_B = "20";
const SECTION_C = "30";
const SECTIONS = [
  { id: SECTION_A, label: "General" },
  { id: SECTION_B, label: "Off-topic" },
  { id: SECTION_C, label: "Support" },
];

const CATALOG = [
  {
    admin: {},
    moderator: normalizePermissionStaffModules({
      topics: [
        { permission: "can_view_reports", scope: FAMILY },
        {
          dependsOn: ["can_view_reports"],
          permission: "can_manage_reports",
          scope: FAMILY,
        },
        "can_pin",
      ],
    }),
    pluginId: FORUM,
  },
];

const SECTION_SCOPE = defineModerationScope({
  find: async (_c, ids) =>
    Promise.resolve(SECTIONS.filter(section => ids.includes(section.id))),
  id: FAMILY,
  label: "@vitnode/forum.scopes.section",
  list: async () => Promise.resolve({ items: SECTIONS, nextCursor: null }),
});

const selected = (...ids: string[]): PermissionStaffScope => ({
  family: FAMILY,
  ids,
  mode: "selected",
});
const everywhere: PermissionStaffScope = { family: FAMILY, mode: "all" };

const topics = (
  permission: string,
  scope?: PermissionStaffScope,
): PermissionsStaffArgs => ({
  module: "topics",
  permission,
  plugin: FORUM,
  ...(scope ? { scope } : {}),
});

const CALLER = { id: 1, roleId: 10 };
const TARGET_ROLE_ID = 20;
const ENTRY = {
  id: 5,
  permissions: [],
  protected: false,
  roleId: TARGET_ROLE_ID,
  unrestricted: false,
  userId: null,
};
const EDIT_MODERATORS: PermissionsStaffArgs = {
  module: "staff_moderators",
  permission: "can_edit",
  plugin: "@vitnode/core",
};

const appFor = async (
  moderator:
    | PermissionsStaffArgs[]
    | StaffPermissionSet = ROOT_STAFF_PERMISSIONS,
) => {
  const cache = createTestCache();
  await grantStaffPermissions(cache, {
    permissions: [EDIT_MODERATORS],
    userId: CALLER.id,
  });
  await grantStaffPermissions(cache, {
    permissions: moderator,
    type: "moderator",
    userId: CALLER.id,
  });
  const memory = createMemoryDb([
    [
      core_roles,
      [
        { default: false, guest: false, id: CALLER.roleId, root: false },
        { default: false, guest: false, id: TARGET_ROLE_ID, root: false },
      ],
    ],
    [core_users_secondary_roles, []],
    [core_moderators_permissions, [ENTRY]],
  ]);
  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("admin", { user: CALLER } as unknown as Context["var"]["admin"]);
    c.set("cache", cache);
    c.set("db", memory.db as unknown as Context["var"]["db"]);
    c.set("core", {
      moderation: {
        scopes: [{ definition: SECTION_SCOPE, pluginId: FORUM }],
        targets: [],
      },
      permissionStaff: CATALOG,
    } as unknown as Context["var"]["core"]);
    await next();
  });
  app.openapi(
    updatePermissionsStaffAdminRoute.route,
    updatePermissionsStaffAdminRoute.handler,
  );

  const save = async (permissions: PermissionsStaffArgs[]) =>
    await app.request(`/entry/moderator/${ENTRY.id}`, {
      body: JSON.stringify({ permissions, unrestricted: false }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  const stored = () => memory.rows(core_moderators_permissions)[0]?.permissions;

  return { save, stored };
};

const VIEW_KEY = `${FORUM}:topics:can_view_reports`;
const MANAGE_KEY = `${FORUM}:topics:can_manage_reports`;

describe("saving scoped moderator permissions", () => {
  it.each<[string, PermissionsStaffArgs[], Record<string, unknown>]>([
    [
      "a scoped permission without a scope",
      [topics("can_view_reports")],
      { key: VIEW_KEY, type: "missing_scope" },
    ],
    [
      "a section id that does not exist",
      [topics("can_view_reports", selected(SECTION_A, "999"))],
      { ids: ["999"], key: VIEW_KEY, type: "unknown_resource" },
    ],
    [
      "an empty selection",
      [topics("can_view_reports", selected())],
      { key: VIEW_KEY, type: "empty_selection" },
    ],
    [
      "managing where the moderator cannot view",
      [
        topics("can_view_reports", selected(SECTION_A)),
        topics("can_manage_reports", selected(SECTION_B)),
      ],
      { dependency: VIEW_KEY, key: MANAGE_KEY, type: "dependency_scope" },
    ],
    [
      "a scope on an unscoped permission",
      [topics("can_pin", everywhere)],
      { key: `${FORUM}:topics:can_pin`, type: "unexpected_scope" },
    ],
  ])("refuses %s", async (_label, permissions, issue) => {
    const { save, stored } = await appFor();

    const res = await save(permissions);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalid_permissions",
      issues: [issue],
    });
    expect(stored()).toEqual([]);
  });

  it("stores a valid selection with its ids sorted and de-duplicated", async () => {
    const { save, stored } = await appFor();

    const res = await save([
      topics("can_view_reports", selected(SECTION_C, SECTION_A, SECTION_C)),
      topics("can_manage_reports", selected(SECTION_A)),
    ]);

    expect(res.status).toBe(200);
    expect(stored()).toEqual([
      topics("can_view_reports", selected(SECTION_A, SECTION_C)),
      topics("can_manage_reports", selected(SECTION_A)),
    ]);
  });

  it("measures delegation against the resources the caller holds", async () => {
    const callerViewsA = [topics("can_view_reports", selected(SECTION_A))];

    const wider = await appFor(callerViewsA);
    expect(
      (
        await wider.save([
          topics("can_view_reports", selected(SECTION_A, SECTION_B)),
        ])
      ).status,
    ).toBe(403);
    expect(wider.stored()).toEqual([]);

    const everywhereRequest = await appFor(callerViewsA);
    expect(
      (await everywhereRequest.save([topics("can_view_reports", everywhere)]))
        .status,
    ).toBe(403);

    const within = await appFor(callerViewsA);
    expect(
      (await within.save([topics("can_view_reports", selected(SECTION_A))]))
        .status,
    ).toBe(200);
    expect(within.stored()).toEqual(callerViewsA);
  });
});
