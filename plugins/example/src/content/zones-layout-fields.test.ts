import type { AnyBlockInstance } from "@vitnode/core/blocks";

import { isBlockAllowed } from "@vitnode/core/blocks";
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
  it("only ships blocks each field's own allowlist accepts", () => {
    const allowed = {
      afterProfile: PAGE_BLOCKS_ALLOWED,
      beforeFooter: PAGE_BLOCKS_ALLOWED,
      beforeProfile: PAGE_BLOCKS_ALLOWED,
      sidebar: PAGE_SIDEBAR_BLOCKS_ALLOWED,
    };

    for (const field of EXAMPLE_ZONE_FIELDS) {
      for (const instance of DEFAULT_EXAMPLE_ZONES_LAYOUT[field]) {
        expect(isBlockAllowed(allowed[field], instance.type)).toBe(true);
      }
    }
  });

  it("gives every block a unique instance id", () => {
    const ids = EXAMPLE_ZONE_FIELDS.flatMap(field =>
      DEFAULT_EXAMPLE_ZONES_LAYOUT[field].map(instance => instance.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });
});
