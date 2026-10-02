import { describe, expect, it } from "vitest";

import { fitZoomedRect, zoomOrigin } from "./image-zoom";

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
