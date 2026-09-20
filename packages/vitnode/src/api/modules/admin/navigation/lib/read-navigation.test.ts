// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { NavigationPreset } from "@/lib/navigation";

import type { NavigationRecord } from "./read-navigation";

import {
  groupNavigationWords,
  navigationTreeOf,
  toPublicNavigation,
  withNavigationPresets,
} from "./read-navigation";

const at = new Date("2026-09-20T10:00:00Z");

const record = (overrides: Partial<NavigationRecord>): NavigationRecord => ({
  createdAt: at,
  description: [],
  href: null,
  icon: null,
  id: 1,
  isOpenInNewTab: false,
  kind: "preset",
  parentId: null,
  pluginId: "@vitnode/core",
  position: 0,
  presetId: "discover",
  title: [],
  updatedAt: at,
  ...overrides,
});

const custom = (
  id: number,
  overrides: Partial<NavigationRecord> = {},
): NavigationRecord =>
  record({
    href: `/custom-${String(id)}`,
    id,
    kind: "custom",
    pluginId: null,
    presetId: null,
    title: [{ languageCode: "en", value: `Custom ${String(id)}` }],
    ...overrides,
  });

const presets: NavigationPreset[] = [
  {
    href: "/discover",
    icon: "icon:compass",
    id: "discover",
    isOpenInNewTab: false,
    pluginId: "@vitnode/core",
  },
];

describe("toPublicNavigation", () => {
  it("lets an item's own icon win over the one its plugin ships", () => {
    const [node] = toPublicNavigation([record({ icon: "icon:star" })], presets);

    expect(node.icon).toBe("icon:star");
  });

  it("resolves a preset's href from the registry, not the row", () => {
    expect(toPublicNavigation([record({ href: "/stale" })], presets)).toEqual([
      {
        description: [],
        href: "/discover",
        icon: "icon:compass",
        id: 1,
        isOpenInNewTab: false,
        items: [],
        kind: "preset",
        pluginId: "@vitnode/core",
        presetId: "discover",
        title: [],
      },
    ]);
  });

  it("skips a preset whose plugin is no longer installed", () => {
    expect(
      toPublicNavigation(
        [record({ pluginId: "@acme/gone", presetId: "page" })],
        presets,
      ),
    ).toEqual([]);
  });

  it("nests children under their parent, in position order", () => {
    const nodes = toPublicNavigation(
      [
        record({}),
        custom(3, { parentId: 1, position: 1 }),
        custom(2, { parentId: 1, position: 0 }),
        custom(4, { position: 1 }),
      ].sort((a, b) => a.position - b.position || a.id - b.id),
      presets,
    );

    expect(nodes.map(node => node.id)).toEqual([1, 4]);
    expect(nodes[0].items.map(item => item.id)).toEqual([2, 3]);
    expect(nodes[1].items).toEqual([]);
  });

  it("promotes the children of a parent the menu has to skip", () => {
    const nodes = toPublicNavigation(
      [
        record({ pluginId: "@acme/gone", presetId: "page" }),
        custom(2, { parentId: 1 }),
        custom(3, { position: 1 }),
      ],
      presets,
    );

    expect(nodes.map(node => node.id)).toEqual([2, 3]);
    expect(nodes[0].items).toEqual([]);
  });

  it("drops a custom link that lost its href", () => {
    expect(toPublicNavigation([custom(2, { href: null })], presets)).toEqual(
      [],
    );
  });
});

describe("navigationTreeOf", () => {
  it("treats a child of a child as a root, so the menu never goes two deep", () => {
    const { childrenOf, roots } = navigationTreeOf([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
      { id: 4, parentId: 99 },
    ]);

    expect(roots.map(root => root.id)).toEqual([1, 3, 4]);
    expect(childrenOf.get(1)?.map(child => child.id)).toEqual([2]);
  });
});

describe("withNavigationPresets", () => {
  it("attaches the preset for the admin list and null when it is missing", () => {
    const [found, missing] = withNavigationPresets(
      [record({}), record({ id: 2, presetId: "gone" })],
      presets,
    );

    expect(found.preset).toEqual(presets[0]);
    expect(missing.preset).toBeNull();
  });
});

describe("groupNavigationWords", () => {
  it("splits title and description translations per item", () => {
    const grouped = groupNavigationWords([
      { itemId: 1, languageCode: "en", value: "Docs", variable: "title" },
      {
        itemId: 1,
        languageCode: "en",
        value: "Guides",
        variable: "description",
      },
      { itemId: 2, languageCode: "en", value: "?", variable: "unknown" },
    ]);

    expect(grouped.get(1)).toEqual({
      description: [{ languageCode: "en", value: "Guides" }],
      title: [{ languageCode: "en", value: "Docs" }],
    });
    expect(grouped.get(2)).toEqual({ description: [], title: [] });
  });
});
