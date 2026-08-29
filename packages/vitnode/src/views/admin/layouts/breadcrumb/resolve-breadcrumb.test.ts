import { describe, expect, it } from "vitest";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { resolveBreadcrumb } from "./resolve-breadcrumb";

/**
 * The AdminCP trail, as a function of the *visible* navigation and a path.
 *
 * The rule matters more than it looks: labels come from the navigation the admin
 * can actually see, so a screen they may not open cannot be named by a crumb
 * either. Everything else falls back to a humanized segment, which is what keeps
 * a dynamic id (`/admin/core/users/42`) from rendering as a blank.
 */

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

  /**
   * The first label wins, which is why the parent "Users" is used rather than
   * the sub-item "List" - both are declared at `/admin/core/users`, and the
   * parent is the one a reader recognises from the sidebar heading.
   */
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

  /**
   * The permission filter has already run by the time nav arrives here, so an
   * entry the admin cannot see is simply absent - and the crumb degrades to the
   * humanized fallback rather than leaking the screen's translated name.
   */
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
