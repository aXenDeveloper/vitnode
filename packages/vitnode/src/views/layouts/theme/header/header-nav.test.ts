import { describe, expect, it } from "vitest";

import { visibleHeaderNavCount } from "./header-nav";

describe("how many items fit in the header", () => {
  it("keeps every item when they all fit, without room for More", () => {
    expect(
      visibleHeaderNavCount({
        availableWidth: 308,
        gap: 4,
        itemWidths: [100, 100, 100],
        moreWidth: 80,
      }),
    ).toBe(3);
  });

  it("leaves room for More once anything overflows", () => {
    expect(
      visibleHeaderNavCount({
        availableWidth: 307,
        gap: 4,
        itemWidths: [100, 100, 100],
        moreWidth: 80,
      }),
    ).toBe(2);
  });

  it("stops at the first item that does not fit, keeping the order", () => {
    expect(
      visibleHeaderNavCount({
        availableWidth: 290,
        gap: 0,
        itemWidths: [100, 150, 50],
        moreWidth: 60,
      }),
    ).toBe(1);
  });

  it("moves everything into More when not even one item fits", () => {
    expect(
      visibleHeaderNavCount({
        availableWidth: 90,
        gap: 4,
        itemWidths: [100, 100],
        moreWidth: 80,
      }),
    ).toBe(0);
  });

  it("shows nothing to overflow when there is nothing", () => {
    expect(
      visibleHeaderNavCount({
        availableWidth: 0,
        gap: 4,
        itemWidths: [],
        moreWidth: 80,
      }),
    ).toBe(0);
  });
});
