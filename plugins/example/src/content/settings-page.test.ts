import type { ContentNode } from "@vitnode/core/widgets";

import { isBlockAllowed, isContentNode } from "@vitnode/core/widgets";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "./page-blocks";
import {
  EXAMPLE_SETTINGS_PAGE_ID,
  EXAMPLE_WIDGETS_PERMISSION,
  EXAMPLE_ZONE_IDS,
  mayEditSettingsPage,
  settingsPage,
} from "./settings-page";

const WIDE_ZONES = [
  EXAMPLE_ZONE_IDS.afterProfile,
  EXAMPLE_ZONE_IDS.beforeFooter,
  EXAMPLE_ZONE_IDS.beforeProfile,
];

const blockTypes = (nodes: readonly ContentNode[]): string[] =>
  nodes.flatMap(node =>
    "kind" in node ? node.children.map(child => child.type) : [node.type],
  );

describe("the settings page definition", () => {
  it("is addressed by a page id, and declares four page-local zones", () => {
    expect(settingsPage.id).toBe(EXAMPLE_SETTINGS_PAGE_ID);
    expect([...settingsPage.zoneIds].sort()).toStrictEqual([
      "after-profile",
      "before-footer",
      "before-profile",
      "sidebar",
    ]);

    for (const zoneId of settingsPage.zoneIds) {
      expect(zoneId).not.toContain(":");
    }
  });

  it("is gated on a moderator permission, named without a plugin", () => {
    expect(settingsPage.permission).toStrictEqual({
      module: EXAMPLE_WIDGETS_PERMISSION.module,
      permission: EXAMPLE_WIDGETS_PERMISSION.permission,
    });
  });

  it("carries the sidebar's narrower allowlist and the wider one elsewhere", () => {
    expect(settingsPage.zones[EXAMPLE_ZONE_IDS.sidebar].allowed).toStrictEqual(
      PAGE_SIDEBAR_BLOCKS_ALLOWED,
    );

    for (const zoneId of WIDE_ZONES) {
      expect(settingsPage.zones[zoneId].allowed).toStrictEqual(
        PAGE_BLOCKS_ALLOWED,
      );
    }
  });

  it("caps every zone, so the editor offers what the API accepts", () => {
    for (const zoneId of settingsPage.zoneIds) {
      expect(settingsPage.zones[zoneId]).toMatchObject({
        max: 20,
        min: undefined,
      });
    }
  });
});

describe("the layout the page ships with", () => {
  it("demonstrates an area holding two blocks, an empty one beside it, and a zone left empty", () => {
    const [filled, empty, beside] =
      settingsPage.zones[EXAMPLE_ZONE_IDS.afterProfile].default;

    expect(filled).toMatchObject({ kind: "area" });
    expect("kind" in filled ? filled.children : []).toHaveLength(2);
    expect(empty).toMatchObject({ children: [], kind: "area" });
    expect(beside).toMatchObject({ type: "core:cta" });
    expect(
      settingsPage.zones[EXAMPLE_ZONE_IDS.beforeFooter].default,
    ).toStrictEqual([]);
  });

  it("stores a variant beside a block's data rather than inside it", () => {
    const features = settingsPage.zones[
      EXAMPLE_ZONE_IDS.beforeProfile
    ].default.find(
      node => !("kind" in node) && node.type === "example:features",
    );

    expect(features).toMatchObject({ variant: "list" });
  });

  it("holds real stored nodes, which is what a reset would restore to", () => {
    for (const zoneId of settingsPage.zoneIds) {
      for (const node of settingsPage.zones[zoneId].default) {
        expect(isContentNode(node)).toBe(true);
      }
    }
  });

  it("ships nothing its own zone would refuse", () => {
    for (const zoneId of settingsPage.zoneIds) {
      const zone = settingsPage.zones[zoneId];

      for (const type of blockTypes(zone.default)) {
        expect(isBlockAllowed(zone.allowed, type), type).toBe(true);
      }
    }
  });
});

describe("who may edit it", () => {
  const holder = {
    module: EXAMPLE_WIDGETS_PERMISSION.module,
    permission: EXAMPLE_WIDGETS_PERMISSION.permission,
    plugin: "@vitnode/example",
  };

  it("lets a root role through without listing a permission", () => {
    expect(mayEditSettingsPage({ permissions: [], root: true })).toBe(true);
  });

  it("lets the permission itself through", () => {
    expect(mayEditSettingsPage({ permissions: [holder], root: false })).toBe(
      true,
    );
  });

  it("refuses a visitor, and anybody holding the permission elsewhere", () => {
    expect(mayEditSettingsPage({ permissions: [], root: false })).toBe(false);

    for (const near of [
      { ...holder, plugin: "@vitnode/core" },
      { ...holder, module: "users" },
      { ...holder, permission: "can_view" },
    ]) {
      expect(mayEditSettingsPage({ permissions: [near], root: false })).toBe(
        false,
      );
    }
  });
});

describe("the page that mounts these zones", () => {
  const page = readFileSync(
    join(import.meta.dirname, "..", "pages", "zones-page.tsx"),
    "utf8",
  );

  it("refuses to render a layout it could not read", () => {
    expect(page).toMatch(/if \(!stored\.ok\) \{\s*throw new Error\(/);
  });

  it("lets the URL request edit mode and the permission decide it", () => {
    expect(page).toContain("useState(canEdit && openEditing)");
    expect(page).toContain("{canEdit && !editing ?");
  });
});
