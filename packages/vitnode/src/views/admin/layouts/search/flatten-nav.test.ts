import { describe, expect, it } from "vitest";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import {
  buildSearchText,
  flattenAdminNav,
  matchesAdminNavItem,
} from "./flatten-nav";

const nav: NavAdminParent[] = [
  {
    id: "core",
    title: "Core",
    items: [
      { href: "/admin/core/", title: "Dashboard" },
      {
        href: "/admin/core/system",
        title: "System",
        items: [
          { href: "/admin/core/system/integrations", title: "Integrations" },
          { href: "/admin/core/system/files", title: "Files" },
        ],
      },
      {
        href: "/admin/core/users",
        title: "Users",
        items: [
          { href: "/admin/core/users", title: "User List" },
          { href: "/admin/core/users/roles", title: "Roles" },
        ],
      },
    ],
  },
  {
    id: "@vitnode/blog",
    title: "Blog",
    items: [{ href: "/admin/blog/posts", title: "Posts" }],
  },
];

describe("flattenAdminNav", () => {
  it("emits only leaves, never a parent that has children", () => {
    const hrefs = flattenAdminNav(nav).map(item => item.href);

    // `/admin/core/system` has no page of its own - only its children do.
    expect(hrefs).not.toContain("/admin/core/system");
    expect(hrefs).toStrictEqual([
      "/admin/core/",
      "/admin/core/system/integrations",
      "/admin/core/system/files",
      "/admin/core/users",
      "/admin/core/users/roles",
      "/admin/blog/posts",
    ]);
  });

  it("keeps a sub-item whose href repeats its parent's exactly once", () => {
    const users = flattenAdminNav(nav).filter(
      item => item.href === "/admin/core/users",
    );

    expect(users).toHaveLength(1);
    // The child wins, so the row reads "Users › User List".
    expect(users[0].title).toBe("User List");
    expect(users[0].parentTitle).toBe("Users");
  });

  it("dedupes on the normalized href, so a trailing slash is not a new row", () => {
    const items = flattenAdminNav([
      {
        id: "core",
        title: "Core",
        items: [
          { href: "/admin/core/thing", title: "First" },
          { href: "/admin/core/thing/", title: "Second" },
        ],
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("First");
  });

  it("carries the group title and inherits the parent icon", () => {
    const icon = "icon-node";
    const [item] = flattenAdminNav([
      {
        id: "core",
        title: "Core",
        items: [
          {
            href: "/admin/core/users",
            icon,
            title: "Users",
            items: [{ href: "/admin/core/users/roles", title: "Roles" }],
          },
        ],
      },
    ]);

    expect(item.groupTitle).toBe("Core");
    expect(item.icon).toBe(icon);
  });

  it("builds searchText from title, parent and group, lower-cased", () => {
    const roles = flattenAdminNav(nav).find(
      item => item.href === "/admin/core/users/roles",
    );

    expect(roles?.searchText).toBe("roles users core");
  });
});

describe("buildSearchText", () => {
  it("drops empty parts and duplicates", () => {
    expect(buildSearchText(["Roles", undefined, "", "roles", "Core"])).toBe(
      "roles core",
    );
  });
});

describe("matchesAdminNavItem", () => {
  const [item] = flattenAdminNav(nav).filter(
    entry => entry.href === "/admin/core/users",
  );

  it("matches every item on an empty query", () => {
    expect(matchesAdminNavItem(item, "")).toBe(true);
    expect(matchesAdminNavItem(item, "   ")).toBe(true);
  });

  it("matches on a partial, case-insensitive fragment", () => {
    expect(matchesAdminNavItem(item, "LIS")).toBe(true);
  });

  it("matches on the parent or group title", () => {
    expect(matchesAdminNavItem(item, "users")).toBe(true);
    expect(matchesAdminNavItem(item, "core")).toBe(true);
  });

  it("requires every token, in any order", () => {
    expect(matchesAdminNavItem(item, "user list")).toBe(true);
    expect(matchesAdminNavItem(item, "list user")).toBe(true);
    expect(matchesAdminNavItem(item, "list nope")).toBe(false);
  });

  it("does not match across a token boundary", () => {
    expect(matchesAdminNavItem(item, "userlist")).toBe(false);
  });

  it("finds a row by another locale's title once searchText carries it", () => {
    // What `getSearchNavItems` produces for a Polish request: the row displays
    // "Role" but is still findable by the English "Roles".
    const polish = {
      ...item,
      searchText: buildSearchText(["Role", "Użytkownicy", "Roles", "Users"]),
      title: "Role",
    };

    expect(matchesAdminNavItem(polish, "roles")).toBe(true);
    expect(matchesAdminNavItem(polish, "użytkownicy")).toBe(true);
  });
});
