import { describe, expect, it } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";

import type {
  AdminNavConfig,
  AdminNavTranslator,
} from "../sidebar/nav/nav-model";

import { buildAdminNav } from "../sidebar/nav/nav-model";
import { flattenAdminNav, matchesAdminNavItem } from "./flatten-nav";
import { adminSearchOnlyItems } from "./search-only-pages";

const CORE = "@vitnode/core";

const t: AdminNavTranslator = Object.assign((key: string): string => key, {
  has: () => false,
});

const config = (plugins: AdminNavConfig["plugins"] = []): AdminNavConfig => ({
  plugins,
});

const root: StaffPermissionSet = { root: true, permissions: [] };

const only = (
  ...permissions: { module: string; permission: string; plugin?: string }[]
): StaffPermissionSet => ({
  root: false,
  permissions: permissions.map(({ module, permission, plugin }) => ({
    module,
    permission,
    plugin: plugin ?? CORE,
  })),
});

/** The whole pipeline: config + permissions -> the palette's page index. */
const searchIndex = (
  permissions: StaffPermissionSet,
  plugins: AdminNavConfig["plugins"] = [],
) => [
  ...flattenAdminNav(
    buildAdminNav({
      permissions,
      t,
      vitNodeConfig: config(plugins) as never,
    }),
  ),
  ...adminSearchOnlyItems({ permissions, t }),
];

const hrefs = (items: { href: string }[]) => items.map(item => item.href);

describe("the palette indexes only what the sidebar shows", () => {
  it("gives a root admin every screen, including the search-only ones", () => {
    const index = searchIndex(root);

    expect(hrefs(index)).toContain("/admin/core/users/roles");
    // Never in the sidebar; reachable from the user menu and the palette.
    expect(hrefs(index)).toContain("/admin/core/debug");
  });

  /**
   * The leak this file exists to prevent. An admin with no permissions gets the
   * dashboard - the one entry behind no permission at all - and nothing else.
   */
  it("leaves an admin with no permissions only the dashboard", () => {
    expect(hrefs(searchIndex(EMPTY_STAFF_PERMISSION_SET))).toEqual([
      "/admin/core/",
    ]);
  });

  it("does not index a screen the admin cannot open", () => {
    const index = hrefs(
      searchIndex(only({ module: "roles", permission: "can_view" })),
    );

    expect(index).toContain("/admin/core/users/roles");
    expect(index).not.toContain("/admin/core/staff/admins");
    expect(index).not.toContain("/admin/core/system/files");
  });

  /**
   * A search-only page carries its own permission tuple rather than inheriting
   * one, because it is not in the navigation to inherit from.
   */
  it("gates a search-only page on its own permission", () => {
    expect(
      hrefs(searchIndex(only({ module: "roles", permission: "can_view" }))),
    ).not.toContain("/admin/core/debug");

    expect(
      hrefs(searchIndex(only({ module: "debug", permission: "can_view" }))),
    ).toContain("/admin/core/debug");
  });

  it("does not index a plugin's screens, or name the plugin, without permission", () => {
    const plugins = [
      {
        pluginId: "@vitnode/example",
        admin: {
          nav: [
            {
              href: "/admin/example/reports",
              id: "reports",
              permission: { module: "reports", permission: "can_view" },
            },
          ],
        },
      },
    ] as unknown as AdminNavConfig["plugins"];

    const hidden = searchIndex(EMPTY_STAFF_PERMISSION_SET, plugins);

    expect(hrefs(hidden)).not.toContain("/admin/example/reports");
    // The group heading is a search field too - it must not leak either.
    expect(hidden.map(item => item.groupTitle)).not.toContain(
      "@vitnode/example.title",
    );

    const visible = searchIndex(
      only({
        module: "reports",
        permission: "can_view",
        plugin: "@vitnode/example",
      }),
      plugins,
    );

    expect(hrefs(visible)).toContain("/admin/example/reports");
  });
});

describe("flattening", () => {
  it("indexes sub-items rather than their parent, and never an href twice", () => {
    const index = flattenAdminNav(
      buildAdminNav({ permissions: root, t, vitNodeConfig: config() as never }),
    );
    const users = hrefs(index).filter(href => href === "/admin/core/users");

    expect(users).toHaveLength(1);
    expect(hrefs(index)).not.toContain("/admin/core/staff");
  });

  it("carries the parent's title so a result says where it lives", () => {
    const index = flattenAdminNav(
      buildAdminNav({ permissions: root, t, vitNodeConfig: config() as never }),
    );
    const roles = index.find(item => item.href === "/admin/core/users/roles");

    expect(roles).toMatchObject({
      groupTitle: "admin.global.nav.core",
      parentTitle: "admin.global.nav.users.title",
    });
  });

  it("preserves an external entry's new-tab classification", () => {
    const plugins = [
      {
        pluginId: "@vitnode/example",
        admin: {
          nav: [
            {
              href: "https://status.example.com",
              id: "status",
              isOpenInNewTab: true,
            },
            { href: "/admin/example/inline", id: "inline" },
          ],
        },
      },
    ] as unknown as AdminNavConfig["plugins"];

    const index = flattenAdminNav(
      buildAdminNav({
        permissions: root,
        t,
        vitNodeConfig: config(plugins) as never,
      }),
    );

    expect(
      index.find(item => item.href === "https://status.example.com"),
    ).toMatchObject({ isOpenInNewTab: true });
    expect(
      index.find(item => item.href === "/admin/example/inline")?.isOpenInNewTab,
    ).toBeUndefined();
  });
});

describe("matching", () => {
  const index = flattenAdminNav(
    buildAdminNav({ permissions: root, t, vitNodeConfig: config() as never }),
  );
  const roles = index.find(item => item.href === "/admin/core/users/roles");

  if (!roles) throw new Error("the roles entry is missing from the index");

  it("matches on every token, in any order", () => {
    expect(matchesAdminNavItem(roles, "roles users")).toBe(true);
    expect(matchesAdminNavItem(roles, "users roles")).toBe(true);
  });

  it("matches a parent's name as well as the item's own", () => {
    expect(matchesAdminNavItem(roles, "nav.users.title")).toBe(true);
  });

  it("does not match a token that appears nowhere", () => {
    expect(matchesAdminNavItem(roles, "roles zzz")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesAdminNavItem(roles, "   ")).toBe(true);
  });
});
