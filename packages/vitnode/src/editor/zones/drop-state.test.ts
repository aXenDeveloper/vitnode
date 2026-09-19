import { describe, expect, it } from "vitest";

import { zoneDropState } from "./drop-state";

const args = {
  active: false,
  inserting: false,
  over: false,
  rejected: false,
};

describe("zoneDropState", () => {
  it("is idle when nothing is happening", () => {
    expect(zoneDropState(args)).toBe("idle");
  });

  it("is inserting when the sidebar targets this zone", () => {
    expect(zoneDropState({ ...args, inserting: true })).toBe("inserting");
  });

  it("is targeting while an accepted block is dragged elsewhere", () => {
    expect(zoneDropState({ ...args, active: true })).toBe("targeting");
  });

  it("prefers the live drag over a pending insert target", () => {
    expect(zoneDropState({ ...args, active: true, inserting: true })).toBe(
      "targeting",
    );
    expect(zoneDropState({ ...args, inserting: true, over: true })).toBe(
      "over",
    );
  });

  it("is over when the pointer is inside the zone", () => {
    expect(zoneDropState({ ...args, active: true, over: true })).toBe("over");
  });

  it("is rejected whatever else is true", () => {
    expect(
      zoneDropState({
        active: true,
        inserting: true,
        over: true,
        rejected: true,
      }),
    ).toBe("rejected");
  });
});
