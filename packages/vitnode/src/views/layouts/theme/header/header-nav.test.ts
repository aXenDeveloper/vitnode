import { describe, expect, it } from "vitest";

import type { PublicNavigationNode } from "@/lib/navigation";

import {
  HEADER_HREF,
  headerNavItemsFrom,
  headerNavNamespaces,
} from "./header-nav";

const node = (
  overrides: Partial<PublicNavigationNode>,
): PublicNavigationNode => ({
  description: [],
  href: "/discover",
  icon: null,
  id: 1,
  isOpenInNewTab: false,
  items: [],
  kind: "preset",
  pluginId: "@vitnode/core",
  presetId: "discover",
  title: [],
  ...overrides,
});

const custom = (
  id: number,
  title: string,
  overrides: Partial<PublicNavigationNode> = {},
): PublicNavigationNode =>
  node({
    href: `/${title.toLowerCase()}`,
    id,
    kind: "custom",
    pluginId: null,
    presetId: null,
    title: [{ languageCode: "en", value: title }],
    ...overrides,
  });

const translate = (namespace: string, key: string) =>
  ({
    "core.navigation": {
      "discover.title": "Discover",
      "search.description": "Find anything",
      "search.title": "Search",
    } as Record<string, string>,
  })[namespace]?.[key];

describe("the main nav", () => {
  const items = [
    node({}),
    node({ href: "/search", id: 2, presetId: "search" }),
    custom(3, "Docs", {
      href: "https://vitnode.com/docs",
      isOpenInNewTab: true,
    }),
  ];

  it("is what the AdminCP saved, in that order", () => {
    expect(headerNavItemsFrom({ items, locale: "en", translate })).toEqual([
      { href: "/discover", id: "1", label: "Discover" },
      {
        description: "Find anything",
        href: "/search",
        id: "2",
        label: "Search",
      },
      {
        href: "https://vitnode.com/docs",
        id: "3",
        isOpenInNewTab: true,
        label: "Docs",
      },
    ]);
  });

  it("turns a parent with children into a dropdown", () => {
    const [community] = headerNavItemsFrom({
      items: [
        custom(10, "Community", {
          items: [
            custom(11, "Members", { isOpenInNewTab: true }),
            custom(12, "Events", {
              description: [{ languageCode: "en", value: "What is on" }],
            }),
          ],
        }),
      ],
      locale: "en",
      translate,
    });

    expect(community.items).toEqual([
      { href: "/members", id: "11", isOpenInNewTab: true, label: "Members" },
      { description: "What is on", href: "/events", id: "12", label: "Events" },
    ]);
  });

  it("leaves out a child nobody can name and keeps the parent a plain link", () => {
    const [parent] = headerNavItemsFrom({
      items: [
        custom(10, "Community", {
          items: [node({ id: 11, presetId: "nameless" })],
        }),
      ],
      locale: "en",
      translate,
    });

    expect(parent.items).toBeUndefined();
  });

  it("drops an item nobody can name", () => {
    expect(
      headerNavItemsFrom({
        items: [node({ presetId: "nameless" })],
        locale: "en",
        translate,
      }),
    ).toEqual([]);
  });

  it("carries the icon the menu item resolved to", () => {
    const [entry] = headerNavItemsFrom({
      items: [node({ icon: "icon:compass" })],
      locale: "en",
      translate,
    });

    expect(entry.icon).toBe("icon:compass");
  });

  it("carries the label it was given, untouched", () => {
    expect(
      headerNavItemsFrom({
        items: [node({ title: [{ languageCode: "pl", value: "Odkrywaj" }] })],
        locale: "pl",
        translate,
      })[0].label,
    ).toBe("Odkrywaj");
  });

  it("gives every link a distinct key", () => {
    const ids = headerNavItemsFrom({
      items: [
        ...items,
        custom(4, "Docs again", { href: "https://vitnode.com/docs" }),
      ],
      locale: "en",
      translate,
    }).map(entry => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the namespaces the header warms", () => {
  it("are the plugins whose presets are in the menu, children included", () => {
    expect(
      headerNavNamespaces(
        [
          custom(10, "Community", {
            items: [
              node({ id: 2, pluginId: "@vitnode/blog", presetId: "posts" }),
            ],
          }),
          node({}),
        ],
        "core.global",
      ),
    ).toEqual(["@vitnode/blog.navigation", "core.navigation"]);
  });

  it("fall back to the namespace every page already has", () => {
    expect(headerNavNamespaces([custom(1, "Docs")], "core.global")).toEqual([
      "core.global",
    ]);
  });
});

describe("the header's destinations", () => {
  it("sends the logo home", () => {
    expect(HEADER_HREF.home).toBe("/");
  });
});
