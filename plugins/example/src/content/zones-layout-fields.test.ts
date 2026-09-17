import type { AnyBlockInstance } from "@vitnode/core/blocks";

import {
  contentNodeBlocks,
  isBlockAllowed,
  isBlockAreaInstance,
} from "@vitnode/core/blocks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PAGE_BLOCKS_ALLOWED,
  PAGE_SIDEBAR_BLOCKS_ALLOWED,
} from "./page-blocks";
import {
  DEFAULT_EXAMPLE_ZONES_LAYOUT,
  EXAMPLE_ZONE_FIELDS,
  EXAMPLE_ZONE_IDS,
  fieldsToZones,
  toZonesLayout,
  zonesToFields,
} from "./zones-layout-fields";

const block = (id: string): AnyBlockInstance => ({
  data: { body: id, heading: id, width: "prose" },
  id,
  type: "core:text",
});

const layout = {
  afterProfile: [block("after")],
  beforeFooter: [],
  beforeProfile: [block("before-1"), block("before-2")],
  sidebar: [block("side")],
};

describe("fieldsToZones", () => {
  it("keys every field by the zone id the page mounts it under", () => {
    expect(fieldsToZones(layout)).toEqual({
      "settings:after-profile": layout.afterProfile,
      "settings:before-footer": [],
      "settings:before-profile": layout.beforeProfile,
      "settings:sidebar": layout.sidebar,
    });
  });
});

describe("zonesToFields", () => {
  it("keys every zone id by the column it is stored in", () => {
    expect(
      zonesToFields(fieldsToZones(layout), DEFAULT_EXAMPLE_ZONES_LAYOUT),
    ).toEqual(layout);
  });

  it("round-trips a layout through both directions unchanged", () => {
    const zones = fieldsToZones(DEFAULT_EXAMPLE_ZONES_LAYOUT);

    expect(zonesToFields(zones, DEFAULT_EXAMPLE_ZONES_LAYOUT)).toEqual(
      DEFAULT_EXAMPLE_ZONES_LAYOUT,
    );
  });

  it("keeps the fallback for a zone the editor snapshot never mounted", () => {
    const partial = { "settings:sidebar": [block("only-side")] };

    expect(zonesToFields(partial, layout)).toEqual({
      ...layout,
      sidebar: [block("only-side")],
    });
  });

  it("copies the snapshot's arrays rather than aliasing them", () => {
    const zones = fieldsToZones(layout);
    const fields = zonesToFields(zones, DEFAULT_EXAMPLE_ZONES_LAYOUT);

    expect(fields.beforeProfile).not.toBe(zones["settings:before-profile"]);
    expect(fields.beforeProfile).toEqual(zones["settings:before-profile"]);
  });

  it("ignores a zone id this page does not own", () => {
    const fields = zonesToFields(
      { ...fieldsToZones(layout), "somewhere:else": [block("stray")] },
      DEFAULT_EXAMPLE_ZONES_LAYOUT,
    );

    expect(Object.keys(fields).sort()).toEqual([...EXAMPLE_ZONE_FIELDS].sort());
  });
});

describe("the zone ids", () => {
  it("never match the column they are stored in", () => {
    for (const field of EXAMPLE_ZONE_FIELDS) {
      expect(EXAMPLE_ZONE_IDS[field]).not.toBe(field);
    }
  });
});

describe("DEFAULT_EXAMPLE_ZONES_LAYOUT", () => {
  const allowed = {
    afterProfile: PAGE_BLOCKS_ALLOWED,
    beforeFooter: PAGE_BLOCKS_ALLOWED,
    beforeProfile: PAGE_BLOCKS_ALLOWED,
    sidebar: PAGE_SIDEBAR_BLOCKS_ALLOWED,
  };

  it("only ships blocks each field's own allowlist accepts, inside an area as well as beside one", () => {
    for (const field of EXAMPLE_ZONE_FIELDS) {
      for (const instance of contentNodeBlocks(
        DEFAULT_EXAMPLE_ZONES_LAYOUT[field],
      )) {
        expect(isBlockAllowed(allowed[field], instance.type)).toBe(true);
      }
    }
  });

  it("gives every block and every area its own instance id", () => {
    const ids = EXAMPLE_ZONE_FIELDS.flatMap(field =>
      DEFAULT_EXAMPLE_ZONES_LAYOUT[field].flatMap(node => [
        node.id,
        ...(isBlockAreaInstance(node)
          ? node.children.map(child => child.id)
          : []),
      ]),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships a block that picked a variant, so the playground opens on one", () => {
    const withVariant = contentNodeBlocks(
      DEFAULT_EXAMPLE_ZONES_LAYOUT.beforeProfile,
    ).filter(instance => instance.variant !== undefined);

    expect(withVariant).toHaveLength(1);
    expect(withVariant[0]).toMatchObject({
      type: "example:features",
      variant: "list",
    });
  });

  it("ships a filled area, an empty one and blocks beside them in the same zone", () => {
    const nodes = DEFAULT_EXAMPLE_ZONES_LAYOUT.afterProfile;
    const areas = nodes.filter(node => isBlockAreaInstance(node));

    expect(areas).toHaveLength(2);
    expect(areas[0]).toMatchObject({ layout: { columns: 2 } });
    expect(areas[0].children).toHaveLength(2);
    expect(areas[1].children).toStrictEqual([]);
    expect(nodes.filter(node => !isBlockAreaInstance(node))).toHaveLength(1);
  });

  it("never nests an area inside an area, because Stage 4 cannot render one", () => {
    for (const field of EXAMPLE_ZONE_FIELDS) {
      for (const node of DEFAULT_EXAMPLE_ZONES_LAYOUT[field]) {
        if (!isBlockAreaInstance(node)) continue;

        expect(node.children.some(child => isBlockAreaInstance(child))).toBe(
          false,
        );
      }
    }
  });
});

describe("the field set a save actually sends", () => {
  it("fills a zone the editor never mounted from the page's own layout, not the shipped defaults", () => {
    const canonical = fieldsToZones(layout);
    const snapshot = { "settings:before-profile": [block("edited")] };

    expect(
      zonesToFields(
        snapshot,
        zonesToFields(canonical, DEFAULT_EXAMPLE_ZONES_LAYOUT),
      ),
    ).toEqual({ ...layout, beforeProfile: [block("edited")] });
  });

  it("stores a zone the editor emptied as empty, rather than resurrecting it", () => {
    const canonical = fieldsToZones(layout);

    expect(
      zonesToFields(
        { ...canonical, "settings:sidebar": [] },
        zonesToFields(canonical, DEFAULT_EXAMPLE_ZONES_LAYOUT),
      ),
    ).toEqual({ ...layout, sidebar: [] });
  });
});

describe("toZonesLayout", () => {
  it("keeps a shipped-defaults answer editable, because nothing is stored yet", () => {
    expect(
      toZonesLayout({
        fields: DEFAULT_EXAMPLE_ZONES_LAYOUT,
        source: "defaults",
        updatedAt: null,
      }),
    ).toEqual({
      source: "defaults",
      updatedAt: null,
      zones: fieldsToZones(DEFAULT_EXAMPLE_ZONES_LAYOUT),
    });
  });

  it("carries a stored answer through with the time it was saved", () => {
    expect(
      toZonesLayout({
        fields: layout,
        source: "stored",
        updatedAt: "2026-09-17T12:00:00.000Z",
      }),
    ).toEqual({
      source: "stored",
      updatedAt: "2026-09-17T12:00:00.000Z",
      zones: fieldsToZones(layout),
    });
  });
});

describe("the layout the page is allowed to edit", () => {
  const loader = readFileSync(
    join(import.meta.dirname, "..", "pages", "zones-page.tsx"),
    "utf8",
  );

  it("refuses to answer a failed read with the shipped defaults", () => {
    expect(loader).toMatch(/if \(!response\.ok\) \{\s*throw new Error\(/);
    expect(loader).not.toContain("shippedDefaults");
  });

  it("builds what it renders from the payload alone", () => {
    expect(loader).toContain("toZonesLayout(await response.json())");
  });

  it("hands the server's own answer back to the editor after a save", () => {
    expect(loader).toContain("return { zones: stored.zones };");
  });
});
