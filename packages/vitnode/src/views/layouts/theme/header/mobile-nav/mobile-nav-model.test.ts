import { describe, expect, it } from "vitest";

import type { HeaderNavItem } from "../header-nav";

import { navigationOutsideBottomBar } from "./mobile-nav-model";

const navigation: HeaderNavItem[] = [
  { href: "/discover", id: "1", label: "Discover" },
  { href: "/search", id: "2", label: "Search" },
  {
    href: "/community",
    id: "3",
    items: [{ href: "/community/blog", id: "31", label: "Blog" }],
    label: "Community",
  },
  { href: "/docs", id: "4", label: "Docs" },
];

describe("navigationOutsideBottomBar", () => {
  it("leaves out header links the bottom bar already shows", () => {
    const rest = navigationOutsideBottomBar(navigation, [
      { href: "/search", id: "b1", label: "Search" },
    ]);

    expect(rest.map(item => item.href)).toEqual([
      "/discover",
      "/community",
      "/docs",
    ]);
  });

  it("keeps a dropdown even when its parent link is in the bar", () => {
    const rest = navigationOutsideBottomBar(navigation, [
      { href: "/community", id: "b1", label: "Community" },
    ]);

    expect(rest.map(item => item.href)).toContain("/community");
  });

  it("returns everything when the bar is empty", () => {
    expect(navigationOutsideBottomBar(navigation, [])).toEqual(navigation);
  });

  it("returns nothing when the bar covers every plain link", () => {
    expect(
      navigationOutsideBottomBar(
        [{ href: "/a", id: "1", label: "A" }],
        [{ href: "/a", id: "b1", label: "A" }],
      ),
    ).toEqual([]);
  });
});
