import { describe, expect, it } from "vitest";

import {
  activeChildHref,
  isNavItemActive,
  isPathnameUnderHref,
  navItemActivity,
} from "./nav-active";

describe("isPathnameUnderHref", () => {
  it("matches the page itself", () => {
    expect(isPathnameUnderHref("/admin/core/users", "/admin/core/users")).toBe(
      true,
    );
  });

  it("matches a page underneath", () => {
    expect(
      isPathnameUnderHref("/admin/core/users/42", "/admin/core/users"),
    ).toBe(true);
  });

  it("does not match a sibling that merely starts with the same characters", () => {
    expect(
      isPathnameUnderHref("/admin/core/users-import", "/admin/core/users"),
    ).toBe(false);
  });

  it("ignores a trailing slash on either side", () => {
    expect(isPathnameUnderHref("/admin/core", "/admin/core/")).toBe(true);
    expect(isPathnameUnderHref("/admin/core/", "/admin/core")).toBe(true);
  });

  it("does not match an unrelated branch", () => {
    expect(isPathnameUnderHref("/admin/core/staff", "/admin/core/users")).toBe(
      false,
    );
  });
});

describe("isNavItemActive", () => {
  it("is the exact page and nothing below it", () => {
    expect(isNavItemActive("/admin/core/users", "/admin/core/users")).toBe(
      true,
    );
    expect(isNavItemActive("/admin/core/users/42", "/admin/core/users")).toBe(
      false,
    );
  });

  /** The dashboard is declared as `/admin/core/`, and is reached as both. */
  it("treats the dashboard's trailing slash as the same page", () => {
    expect(isNavItemActive("/admin/core", "/admin/core/")).toBe(true);
  });
});

describe("activeChildHref", () => {
  const items = [
    { href: "/admin/core/users", title: "List" },
    { href: "/admin/core/users/roles", title: "Roles" },
  ];

  it("picks the longest match, not the first", () => {
    expect(activeChildHref("/admin/core/users/roles", items)).toBe(
      "/admin/core/users/roles",
    );
  });

  it("picks the shallower item when only it matches", () => {
    expect(activeChildHref("/admin/core/users/42", items)).toBe(
      "/admin/core/users",
    );
  });

  it("is null when the visitor is elsewhere", () => {
    expect(activeChildHref("/admin/core/staff/admins", items)).toBeNull();
  });

  it("is null for an item with no sub-items", () => {
    expect(activeChildHref("/admin/core/users", [])).toBeNull();
  });
});

describe("navItemActivity", () => {
  const item = {
    href: "/admin/core/users",
    items: [
      { href: "/admin/core/users", title: "List" },
      { href: "/admin/core/users/roles", title: "Roles" },
    ],
  };

  /**
   * The three answers have to agree: a parent reporting `hasActiveChild` while
   * `activeChild` is null would open a collapsible with nothing highlighted.
   */
  it("reports an open parent and the child that opened it", () => {
    expect(navItemActivity("/admin/core/users/roles", item)).toEqual({
      activeChild: "/admin/core/users/roles",
      hasActiveChild: true,
      isActive: false,
    });
  });

  it("reports the parent itself as active when it is the page", () => {
    expect(navItemActivity("/admin/core/users", item)).toEqual({
      activeChild: "/admin/core/users",
      hasActiveChild: true,
      isActive: true,
    });
  });

  it("reports nothing active when the visitor is in another group", () => {
    expect(navItemActivity("/admin/core/staff", item)).toEqual({
      activeChild: null,
      hasActiveChild: false,
      isActive: false,
    });
  });

  it("handles a leaf item with no sub-items", () => {
    expect(navItemActivity("/admin/core/", { href: "/admin/core/" })).toEqual({
      activeChild: null,
      hasActiveChild: false,
      isActive: true,
    });
  });
});
