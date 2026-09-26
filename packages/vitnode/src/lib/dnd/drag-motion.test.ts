import { describe, expect, it } from "vitest";

import { DRAG_LIFT_SCALE, settleTransform } from "./drag-motion";

const layoutBox = { height: 80, left: 100, top: 50, width: 300 };
const translate = { x: 400, y: 120 };

const liftedOverlay = () => {
  const centerX = layoutBox.left + translate.x + layoutBox.width / 2;
  const centerY = layoutBox.top + translate.y + layoutBox.height / 2;
  const width = layoutBox.width * DRAG_LIFT_SCALE;
  const height = layoutBox.height * DRAG_LIFT_SCALE;

  return {
    height,
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
  };
};

const landedBox = (target: {
  height: number;
  left: number;
  top: number;
  width: number;
}) => {
  const settled = settleTransform({
    initial: { ...translate, scaleX: 1, scaleY: 1 },
    overlay: liftedOverlay(),
    target,
  });
  const netScale = settled.scaleX * DRAG_LIFT_SCALE;
  const width = layoutBox.width * netScale;
  const height = layoutBox.height * netScale;
  const centerX = layoutBox.left + settled.x + layoutBox.width / 2;
  const centerY = layoutBox.top + settled.y + layoutBox.height / 2;

  return {
    height,
    left: centerX - width / 2,
    netScale,
    top: centerY - height / 2,
    width,
  };
};

describe("the drop animation that settles a lifted widget", () => {
  it("lands the overlay exactly on the node, back at its own size", () => {
    const target = { height: 80, left: 20, top: 500, width: 300 };
    const landed = landedBox(target);

    expect(landed.netScale).toBeCloseTo(1, 10);
    expect(landed.left).toBeCloseTo(target.left, 10);
    expect(landed.top).toBeCloseTo(target.top, 10);
    expect(landed.width).toBeCloseTo(target.width, 10);
    expect(landed.height).toBeCloseTo(target.height, 10);
  });

  it("aligns the start corner when the node landed in a narrower slot", () => {
    const target = { height: 80, left: 640, top: 210, width: 140 };
    const landed = landedBox(target);

    expect(landed.left).toBeCloseTo(target.left, 10);
    expect(landed.top).toBeCloseTo(target.top, 10);
    expect(landed.netScale).toBeCloseTo(1, 10);
  });
});
