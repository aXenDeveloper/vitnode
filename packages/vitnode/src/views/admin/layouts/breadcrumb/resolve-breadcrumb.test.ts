import { describe, expect, it } from "vitest";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { resolveBreadcrumb } from "./resolve-breadcrumb";

const nav: NavAdminParent[] = [
  {
    id: "core",
    title: "Core",
    items: [
      { href: "/admin/core/", title: "Dashboard" },
      {
        href: "/admin/core/users",
        title: "Users",
        items: [
          { href: "/admin/core/users", title: "List" },
          { href: "/admin/core/users/roles", title: "Roles" },
        ],
      },
    ],
  },
];

describe("resolveBreadcrumb", () => {
  it("names a group from its own id", () => {
    expect(resolveBreadcrumb(nav, ["core"])).toEqual([
      {
        href: "/admin/core",
        isCurrent: true,
        isKnown: true,
        isLink: false,
        label: "Core",
      },
    ]);
  });

  it("links every crumb but the last", () => {
    const crumbs = resolveBreadcrumb(nav, ["core", "users", "roles"]);

    expect(crumbs.map(crumb => [crumb.label, crumb.isLink])).toEqual([
      ["Core", true],
      ["Users", true],
      ["Roles", false],
    ]);
  });

  it("prefers the first declaration when two entries share an href", () => {
    const [, users] = resolveBreadcrumb(nav, ["core", "users"]);

    expect(users.label).toBe("Users");
  });

  it("humanizes a segment the navigation does not name, and does not link it", () => {
    const crumbs = resolveBreadcrumb(nav, ["core", "users", "reset-password"]);
    const last = crumbs[crumbs.length - 1];

    expect(last).toMatchObject({
      isKnown: false,
      isLink: false,
      label: "Reset Password",
    });
  });

  /**
   * A crumb in the middle that the navigation cannot name is still not a link -
   * it would point at a URL nothing serves.
   */
  it("does not link an unknown crumb in the middle of the trail", () => {
    const crumbs = resolveBreadcrumb(nav, ["core", "unknown", "roles"]);

    expect(crumbs[1]).toMatchObject({ isKnown: false, isLink: false });
  });

  it("falls back for a screen missing from the visible navigation", () => {
    const withoutUsers: NavAdminParent[] = [
      {
        id: "core",
        title: "Core",
        items: [{ href: "/admin/core/", title: "Dashboard" }],
      },
    ];
    const crumbs = resolveBreadcrumb(withoutUsers, ["core", "users"]);

    expect(crumbs[1]).toMatchObject({ isKnown: false, label: "Users" });
  });

  it("is empty for an empty path", () => {
    expect(resolveBreadcrumb(nav, [])).toEqual([]);
  });
});
