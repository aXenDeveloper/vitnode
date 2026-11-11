import { z } from "@hono/zod-openapi";
import { describe, expectTypeOf, it } from "vitest";

import type { AdminDashboardWidget, AdminNavDeclaration } from "./plugin";

import { buildRoute } from "../api/lib/route";
import {
  type AdminStaffPermissionRef,
  defineStaffPermissions,
  type ModeratorStaffPermissionRef,
} from "./staff-permissions";

const permissions = defineStaffPermissions(
  { id: "@vitnode/notes" },
  {
    admin: { notes: ["can_view", { permission: "can_edit" }] },
    moderator: { notes: ["can_view"] },
  },
);

const route = {
  method: "get",
  path: "/",
  responses: {
    200: {
      content: { "application/json": { schema: z.object({}) } },
      description: "OK",
    },
  },
} as const;

describe("defineStaffPermissions", () => {
  it("types each reference by staff type, plugin, module and permission", () => {
    expectTypeOf(permissions.admin.notes.canEdit).toEqualTypeOf<
      AdminStaffPermissionRef<"@vitnode/notes", "notes", "can_edit">
    >();
    expectTypeOf(permissions.moderator.notes.canView).toEqualTypeOf<
      ModeratorStaffPermissionRef<"@vitnode/notes", "notes", "can_view">
    >();
  });

  it("has no reference for an undeclared permission or module", () => {
    // @ts-expect-error `can_delete` is not declared.
    void permissions.admin.notes.canDelete;
    // @ts-expect-error `posts` is not declared.
    void permissions.admin.posts;
    // @ts-expect-error `notes.can_edit` is an admin permission only.
    void permissions.moderator.notes.canEdit;
  });
});

describe("buildRoute staff permissions", () => {
  it("accepts a reference of its own staff type", () => {
    buildRoute({
      pluginId: "@vitnode/notes",
      adminStaffPermission: permissions.admin.notes.canView,
      moderatorStaffPermission: permissions.moderator.notes.canView,
      route,
      handler: c => c.json({}, 200),
    });
  });

  it("refuses the other staff type, even with the same strings", () => {
    buildRoute({
      pluginId: "@vitnode/notes",
      // @ts-expect-error A moderator reference is not an admin one.
      adminStaffPermission: permissions.moderator.notes.canView,
      route,
      handler: c => c.json({}, 200),
    });
    buildRoute({
      pluginId: "@vitnode/notes",
      // @ts-expect-error An admin reference is not a moderator one.
      moderatorStaffPermission: permissions.admin.notes.canView,
      route,
      handler: c => c.json({}, 200),
    });
  });

  it("refuses a hand-written literal, even with staffType and plugin", () => {
    buildRoute({
      pluginId: "@vitnode/notes",
      // @ts-expect-error Only defineStaffPermissions creates a reference.
      adminStaffPermission: {
        module: "notes",
        permission: "can_view",
        plugin: "@vitnode/notes",
        staffType: "admin",
      },
      route,
      handler: c => c.json({}, 200),
    });
  });
});

describe("AdminCP navigation and widgets", () => {
  it("accept admin references", () => {
    expectTypeOf({
      id: "notes",
      href: "/admin/notes",
      permission: permissions.admin.notes.canView,
      items: [
        {
          id: "edit",
          href: "/admin/notes/edit",
          permission: permissions.admin.notes.canEdit,
        },
      ],
    }).toExtend<AdminNavDeclaration>();
  });

  it("refuse moderator references and literals", () => {
    const item: AdminNavDeclaration = {
      id: "notes",
      href: "/admin/notes",
      // @ts-expect-error AdminCP navigation takes admin references only.
      permission: permissions.moderator.notes.canView,
    };
    const parent: AdminNavDeclaration = {
      id: "notes",
      href: "/admin/notes",
      items: [
        {
          id: "edit",
          href: "/admin/notes/edit",
          // @ts-expect-error Sub-items take admin references only.
          permission: permissions.moderator.notes.canView,
        },
      ],
    };
    const literal: AdminNavDeclaration = {
      id: "notes",
      href: "/admin/notes",
      // @ts-expect-error A hand-written literal is not a reference.
      permission: { module: "notes", permission: "can_view" },
    };
    void [item, parent, literal];

    expectTypeOf(permissions.moderator.notes.canView).not.toExtend<
      AdminDashboardWidget["permission"]
    >();
  });
});
