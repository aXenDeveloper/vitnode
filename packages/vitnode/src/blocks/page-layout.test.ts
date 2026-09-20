import { describe, expect, it } from "vitest";

import type { VisualEditorSaveInput } from "../editor/adapter/types";
import type { ContentNode } from "./types";

import { adoptedZones, layoutKey, layoutZones } from "./page-layout";

const block = (heading: string, id: string): ContentNode => ({
  data: { heading },
  id,
  type: "core:text",
});

const layout = {
  pageId: "example:settings",
  updatedAt: "2026-01-01T00:00:00.000Z",
  zones: { main: [block("Stored", "s1")] },
};

const input = (
  changedZoneIds: string[],
  zones: Record<string, ContentNode[]>,
): VisualEditorSaveInput => ({
  changedZoneIds,
  expectedZones: Object.fromEntries(
    changedZoneIds.map(zoneId => [zoneId, [block("Baseline", "b1")]]),
  ),
  zones,
});

describe("what a page renders before anyone edits it", () => {
  it("is what the layout holds", () => {
    expect(layoutZones(layout)).toStrictEqual(layout.zones);
  });

  it("is nothing at all when no layout was loaded, so zones fall back to their defaults", () => {
    expect(layoutZones(null)).toStrictEqual({});
    expect(layoutZones(undefined)).toStrictEqual({});
  });
});

describe("when a re-render is allowed to reseed the page", () => {
  it("is not on every render, which would revert a save the moment it landed", () => {
    expect(layoutKey({ ...layout, zones: { ...layout.zones } })).toBe(
      layoutKey(layout),
    );
  });

  it("is when the server says the layout moved", () => {
    expect(
      layoutKey({ ...layout, updatedAt: "2026-02-02T00:00:00.000Z" }),
    ).not.toBe(layoutKey(layout));
  });

  it("is when the page itself changed", () => {
    expect(layoutKey({ ...layout, pageId: "example:home" })).not.toBe(
      layoutKey(layout),
    );
  });

  it("tells a page with no stored row apart from a page with no layout at all", () => {
    expect(layoutKey({ ...layout, updatedAt: null })).not.toBe(layoutKey(null));
    expect(layoutKey(null)).toBe("");
  });
});

describe("what a page adopts once a save lands", () => {
  it("is the canonical answer the server gave", () => {
    const canonical = { main: [block("Canonical", "c1")] };

    expect(
      adoptedZones(
        input(["main"], { main: [block("Edited", "e1")] }),
        canonical,
      ),
    ).toStrictEqual(canonical);
  });

  it("is what it sent, when the adapter answered with nothing at all", () => {
    const sent = { main: [block("Edited", "e1")] };

    expect(adoptedZones(input(["main"], sent), undefined)).toStrictEqual(sent);
  });

  it("is only the zones that changed, never the ones it merely rendered", () => {
    expect(
      adoptedZones(
        input(["main"], {
          main: [block("Edited", "e1")],
          sidebar: [block("Untouched", "u1")],
        }),
        undefined,
      ),
    ).toStrictEqual({ main: [block("Edited", "e1")] });
  });

  it("is nothing when nothing changed", () => {
    expect(
      adoptedZones(input([], { main: [block("Stored", "s1")] }), undefined),
    ).toStrictEqual({});
  });
});
