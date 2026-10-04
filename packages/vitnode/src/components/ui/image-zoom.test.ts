import { describe, expect, it } from "vitest";

import {
  dragBackdropOpacity,
  fitZoomedRect,
  projectDragOffset,
  shouldDismissZoom,
  zoomOrigin,
} from "./image-zoom-utils";

describe("fitZoomedRect", () => {
  it("fills the width of a tall viewport and centres vertically", () => {
    expect(fitZoomedRect(2, { height: 1000, padding: 10, width: 400 })).toEqual(
      { height: 190, left: 10, top: 405, width: 380 },
    );
  });

  it("fills the height of a wide viewport and centres horizontally", () => {
    expect(fitZoomedRect(1, { height: 500, padding: 50, width: 1200 })).toEqual(
      { height: 400, left: 400, top: 50, width: 400 },
    );
  });
});

describe("zoomOrigin", () => {
  it("moves and shrinks the zoomed image back onto the thumbnail", () => {
    expect(
      zoomOrigin(
        { height: 50, left: 100, top: 300, width: 100 },
        { height: 200, left: 40, top: 60, width: 400 },
      ),
    ).toEqual({ scale: 0.25, x: 60, y: 240 });
  });
});

describe("projectDragOffset", () => {
  it("keeps the offset when the finger lifts without velocity", () => {
    expect(projectDragOffset(80, 0)).toBe(80);
  });

  it("projects a flick to where momentum would carry it", () => {
    expect(projectDragOffset(20, 1000)).toBeCloseTo(519);
  });
});

describe("shouldDismissZoom", () => {
  it("springs back after a short, slow drag", () => {
    expect(
      shouldDismissZoom({ offset: { x: 0, y: 60 }, velocity: { x: 0, y: 50 } }),
    ).toBe(false);
  });

  it("dismisses after a long drag", () => {
    expect(
      shouldDismissZoom({ offset: { x: 0, y: 200 }, velocity: { x: 0, y: 0 } }),
    ).toBe(true);
  });

  it("dismisses a short but fast flick in any direction", () => {
    expect(
      shouldDismissZoom({
        offset: { x: -30, y: 0 },
        velocity: { x: -600, y: 0 },
      }),
    ).toBe(true);
  });

  it("springs back when a flick reverses the drag", () => {
    expect(
      shouldDismissZoom({
        offset: { x: 0, y: 150 },
        velocity: { x: 0, y: -400 },
      }),
    ).toBe(false);
  });
});

describe("dragBackdropOpacity", () => {
  it("stays opaque at rest", () => {
    expect(dragBackdropOpacity({ x: 0, y: 0 })).toBe(1);
  });

  it("fades as the image moves away", () => {
    expect(dragBackdropOpacity({ x: 0, y: 240 })).toBeCloseTo(0.5);
  });

  it("never fades out completely while dragging", () => {
    expect(dragBackdropOpacity({ x: 2000, y: 2000 })).toBe(0.2);
  });
});
