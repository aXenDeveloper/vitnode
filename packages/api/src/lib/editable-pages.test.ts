import { describe, expect, it } from "vitest";

import type { EditablePagePermission } from "@/content/editor/types";

import { defineEditablePage } from "@/content/editor/define";

import {
  assertEditablePagePermissionsGrantable,
  EditablePageRegistryError,
  registerEditablePage,
  validateEditablePages,
} from "./editable-pages";
import { normalizePermissionStaffModules } from "./permission-staff";

const page = (
  id: string,
  permission: EditablePagePermission = {
    module: "widgets",
    permission: "can_edit",
  },
) =>
  defineEditablePage({
    id,
    permission,
    zones: { sidebar: { allowed: ["core:text"] } },
  });

describe("registerEditablePage", () => {
  it("resolves the permission's plugin to whoever registered the page", () => {
    const entry = registerEditablePage(
      page("example:settings"),
      "@vitnode/example",
    );

    expect(entry.permission).toEqual({
      module: "widgets",
      permission: "can_edit",
      plugin: "@vitnode/example",
    });
  });

  it("keeps an explicit plugin, so a page can point at another one's module", () => {
    const entry = registerEditablePage(
      page("example:settings", {
        module: "users",
        permission: "can_edit",
        plugin: "@vitnode/core",
      }),
      "@vitnode/example",
    );

    expect(entry.permission.plugin).toBe("@vitnode/core");
  });
});

describe("validateEditablePages", () => {
  it("accepts distinct page ids", () => {
    const entries = validateEditablePages([
      registerEditablePage(page("example:settings"), "@vitnode/example"),
      registerEditablePage(page("blog:index"), "@vitnode/blog"),
    ]);

    expect(entries.map(entry => entry.page.id)).toEqual([
      "example:settings",
      "blog:index",
    ]);
  });

  it("refuses one plugin registering a page id twice", () => {
    expect(() =>
      validateEditablePages([
        registerEditablePage(page("example:settings"), "@vitnode/example"),
        registerEditablePage(page("example:settings"), "@vitnode/example"),
      ]),
    ).toThrow(EditablePageRegistryError);
  });

  it("refuses two plugins claiming one page id", () => {
    expect(() =>
      validateEditablePages([
        registerEditablePage(page("example:settings"), "@vitnode/example"),
        registerEditablePage(page("example:settings"), "@vitnode/blog"),
      ]),
    ).toThrow(/both register/);
  });

  it("refuses a page whose permission names no module", () => {
    expect(() =>
      validateEditablePages([
        registerEditablePage(
          // @ts-expect-error - `module` is required, so only a JS caller reaches this guard
          page("example:settings", { permission: "can_edit" }),
          "@vitnode/example",
        ),
      ]),
    ).toThrow(/permission/);
  });
});

describe("assertEditablePagePermissionsGrantable", () => {
  const catalog = (
    moderator: Record<string, string[]>,
    pluginId = "@vitnode/example",
  ) => [
    {
      admin: normalizePermissionStaffModules({}),
      moderator: normalizePermissionStaffModules(moderator),
      pluginId,
    },
  ];

  const grantable = (
    moderator: Record<string, string[]>,
    permission?: EditablePagePermission,
  ) =>
    assertEditablePagePermissionsGrantable({
      pages: [
        registerEditablePage(
          page("example:settings", permission),
          "@vitnode/example",
        ),
      ],
      permissionStaff: catalog(moderator),
    });

  it("accepts a page whose permission its plugin declares", () => {
    expect(() => grantable({ widgets: ["can_edit"] })).not.toThrow();
  });

  it("refuses a page whose plugin declares no such module", () => {
    expect(() => grantable({ articles: ["can_edit"] })).toThrow(
      EditablePageRegistryError,
    );
  });

  it("refuses a page whose module declares no such permission", () => {
    expect(() => grantable({ widgets: ["can_view"] })).toThrow(
      /never declares/,
    );
  });

  it("refuses a page whose plugin declares no moderator permissions at all", () => {
    expect(() => grantable({})).toThrow(/permission nobody holds/);
  });

  it("does not take a module off Object.prototype", () => {
    expect(() =>
      grantable(
        { widgets: ["can_edit"] },
        {
          module: "constructor",
          permission: "can_edit",
        },
      ),
    ).toThrow(EditablePageRegistryError);
  });

  it("checks the named plugin when a page points at another one's module", () => {
    const pages = [
      registerEditablePage(
        page("example:settings", {
          module: "users",
          permission: "can_edit",
          plugin: "@vitnode/core",
        }),
        "@vitnode/example",
      ),
    ];

    expect(() =>
      assertEditablePagePermissionsGrantable({
        pages,
        permissionStaff: catalog({ users: ["can_edit"] }),
      }),
    ).toThrow(/no plugin "@vitnode\/core" is installed/);

    expect(() =>
      assertEditablePagePermissionsGrantable({
        pages,
        permissionStaff: [
          ...catalog({ users: ["can_edit"] }),
          ...catalog({ users: ["can_edit"] }, "@vitnode/core"),
        ],
      }),
    ).not.toThrow();
  });
});
