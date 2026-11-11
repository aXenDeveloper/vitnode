import { describe, expect, it } from "vitest";

import {
  declaredStaffPermission,
  defineStaffPermissions,
} from "./staff-permissions";

const manifest = { id: "@vitnode/notes" };

describe("defineStaffPermissions", () => {
  it("creates frozen references that carry their staff type and plugin", () => {
    const permissions = defineStaffPermissions(manifest, {
      admin: {
        notes: [
          "can_view",
          { permission: "view-logs", dependsOn: ["can_view"] },
        ],
      },
      moderator: { notes: ["can_view"] },
    });

    expect(permissions.pluginId).toBe("@vitnode/notes");
    expect(permissions.admin.notes.viewLogs).toEqual({
      module: "notes",
      permission: "view-logs",
      plugin: "@vitnode/notes",
      staffType: "admin",
    });
    expect(permissions.moderator.notes.canView).toEqual({
      module: "notes",
      permission: "can_view",
      plugin: "@vitnode/notes",
      staffType: "moderator",
    });
    expect(permissions.admin.notes.canView).not.toBe(
      permissions.moderator.notes.canView,
    );
    expect(Object.isFrozen(permissions.admin)).toBe(true);
    expect(Object.isFrozen(permissions.admin.notes)).toBe(true);
    expect(Object.isFrozen(permissions.admin.notes.canView)).toBe(true);
    expect(permissions.config.admin.notes).toEqual([
      "can_view",
      { permission: "view-logs", dependsOn: ["can_view"] },
    ]);
  });

  it("refuses two permission names of one module that share a reference key", () => {
    expect(() =>
      defineStaffPermissions(manifest, {
        admin: { notes: ["can_edit", "can-edit"] },
      }),
    ).toThrow(/collide on reference key "canEdit"/);
  });

  it("allows one key in another module or staff type", () => {
    expect(() =>
      defineStaffPermissions(manifest, {
        admin: { notes: ["can_edit", "can_edit"], posts: ["can_edit"] },
        moderator: { notes: ["can_edit"] },
      }),
    ).not.toThrow();
  });
});

describe("declaredStaffPermission", () => {
  const entries = ["can_view", { permission: "can_edit", dependsOn: [] }];

  it("references a permission the generated entries declare", () => {
    const ref = declaredStaffPermission({
      entries,
      module: "article",
      permission: "can_edit",
      plugin: "@vitnode/notes",
      staffType: "admin",
    });

    expect(ref).toEqual({
      module: "article",
      permission: "can_edit",
      plugin: "@vitnode/notes",
      staffType: "admin",
    });
    expect(Object.isFrozen(ref)).toBe(true);
  });

  it("throws for a permission the entries do not declare", () => {
    expect(() =>
      declaredStaffPermission({
        entries,
        module: "article",
        permission: "can_publish",
        plugin: "@vitnode/notes",
        staffType: "admin",
      }),
    ).toThrow(/"can_publish" is not generated for the "article" module/);
  });
});
