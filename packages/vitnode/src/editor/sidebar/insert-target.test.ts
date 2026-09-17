import { describe, expect, it } from "vitest";

import { insertTargetScope } from "./insert-target";

describe("the target the Available Blocks header names", () => {
  it("has nothing to name while nothing is targeted", () => {
    expect(insertTargetScope(null)).toBeNull();
  });

  it("names the zone when the target sits at a zone's own root", () => {
    expect(
      insertTargetScope({ areaId: null, index: 0, zoneId: "settings:sidebar" }),
    ).toBe("zone");
  });

  it("says an area instead, because the zone id alone would be a lie", () => {
    expect(
      insertTargetScope({
        areaId: "01JEXAMPLEAREA0000000001",
        index: 1,
        zoneId: "settings:sidebar",
      }),
    ).toBe("area");
  });
});
