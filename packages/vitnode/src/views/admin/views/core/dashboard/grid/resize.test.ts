import { describe, expect, it } from "vitest";

import type { GridMetrics } from "./resize";

import { resizeTarget, stepSize } from "./resize";

const threeColumns: GridMetrics = {
  columns: 3,
  gap: 16,
  rowHeights: { 1: 224, 2: 320, 3: 448 },
  track: 240,
};

const drag = (
  dx: number,
  dy: number,
  {
    metrics = threeColumns,
    minSpan = 1,
    rows = 1,
    span = 1,
  }: {
    metrics?: GridMetrics;
    minSpan?: 1 | 2 | 3;
    rows?: 1 | 2 | 3;
    span?: 1 | 2 | 3;
  } = {},
) => resizeTarget({ dx, dy, metrics, minSpan, start: { rows, span } });

describe("resizing a dashboard widget by its corner", () => {
  it("keeps the size while the corner has not travelled", () => {
    expect(drag(0, 0, { rows: 2, span: 2 })).toStrictEqual({
      rows: 2,
      span: 2,
    });
  });

  it("snaps to the next column once the corner passes half of it", () => {
    expect(drag(120, 0)).toStrictEqual({ rows: 1, span: 1 });
    expect(drag(140, 0)).toStrictEqual({ rows: 1, span: 2 });
    expect(drag(600, 0)).toStrictEqual({ rows: 1, span: 3 });
  });

  it("snaps the height to the nearest row size", () => {
    expect(drag(0, 60)).toStrictEqual({ rows: 2, span: 1 });
    expect(drag(0, 400)).toStrictEqual({ rows: 3, span: 1 });
    expect(drag(0, -300, { rows: 3 })).toStrictEqual({ rows: 1, span: 1 });
  });

  it("never goes narrower than the widget allows", () => {
    expect(drag(-600, 0, { minSpan: 2, span: 3 })).toStrictEqual({
      rows: 1,
      span: 2,
    });
  });

  it("does not quietly shrink a wide widget on a narrower screen", () => {
    const twoColumns = { ...threeColumns, columns: 2 };

    expect(drag(0, 0, { metrics: twoColumns, span: 3 })).toStrictEqual({
      rows: 1,
      span: 3,
    });
    expect(drag(-300, 0, { metrics: twoColumns, span: 3 })).toStrictEqual({
      rows: 1,
      span: 1,
    });
  });

  it("only changes the height on a single-column screen", () => {
    const oneColumn = { ...threeColumns, columns: 1 };

    expect(drag(900, 200, { metrics: oneColumn, span: 2 })).toStrictEqual({
      rows: 3,
      span: 2,
    });
  });
});

describe("resizing a dashboard widget from the keyboard", () => {
  const size = { rows: 2, span: 2 } as const;

  it("widens and narrows with the arrows pointing along the reading direction", () => {
    expect(
      stepSize({ key: "ArrowRight", minSpan: 1, rtl: false, size }),
    ).toStrictEqual({ rows: 2, span: 3 });
    expect(
      stepSize({ key: "ArrowLeft", minSpan: 1, rtl: false, size }),
    ).toStrictEqual({ rows: 2, span: 1 });
    expect(
      stepSize({ key: "ArrowLeft", minSpan: 1, rtl: true, size }),
    ).toStrictEqual({ rows: 2, span: 3 });
  });

  it("grows and shrinks the height with down and up", () => {
    expect(
      stepSize({ key: "ArrowDown", minSpan: 1, rtl: false, size }),
    ).toStrictEqual({ rows: 3, span: 2 });
    expect(
      stepSize({ key: "ArrowUp", minSpan: 1, rtl: false, size }),
    ).toStrictEqual({ rows: 1, span: 2 });
  });

  it("stops at the edges instead of wrapping", () => {
    expect(
      stepSize({ key: "ArrowLeft", minSpan: 2, rtl: false, size }),
    ).toStrictEqual({ rows: 2, span: 2 });
    expect(
      stepSize({
        key: "ArrowDown",
        minSpan: 1,
        rtl: false,
        size: { rows: 3, span: 1 },
      }),
    ).toStrictEqual({ rows: 3, span: 1 });
  });

  it("leaves every other key alone", () => {
    expect(stepSize({ key: "Enter", minSpan: 1, rtl: false, size })).toBeNull();
  });
});
