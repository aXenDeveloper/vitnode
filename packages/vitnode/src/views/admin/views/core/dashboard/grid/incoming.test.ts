import { describe, expect, it } from "vitest";

import { INCOMING_ID, nextIncomingIndex, pointsAtBoard } from "./incoming";

const END = "end";
const itemIds = ["notes", "send-notification", "stats"];

const next = (overId: null | string, current: null | number = null) =>
  nextIncomingIndex({ current, endId: END, itemIds, overId });

describe("where a widget dragged from the panel will land", () => {
  it("opens the gap in front of the card under the pointer", () => {
    expect(next("notes")).toBe(0);
    expect(next("stats")).toBe(2);
  });

  it("goes last over the end slot", () => {
    expect(next(END)).toBe(3);
  });

  it("stays put while the pointer rests on the gap it opened", () => {
    expect(next(INCOMING_ID, 1)).toBe(1);
  });

  it("closes the gap once the pointer leaves the board", () => {
    expect(next(null, 2)).toBeNull();
  });

  it("ignores a target that is not on the board", () => {
    expect(next("panel:notes", 1)).toBe(1);
    expect(next("panel:notes")).toBeNull();
  });
});

describe("whether a widget dragged from the panel is over the board", () => {
  const targets = [
    { bottom: 300, left: 0, right: 500, top: 0 },
    { bottom: 300, left: 520, right: 760, top: 0 },
    { bottom: 520, left: 0, right: 500, top: 320 },
  ];

  it("counts the gaps between cards as the board", () => {
    expect(pointsAtBoard({ pointer: { x: 510, y: 150 }, targets })).toBe(true);
    expect(pointsAtBoard({ pointer: { x: 250, y: 310 }, targets })).toBe(true);
  });

  it("does not count the panel beside the board", () => {
    expect(pointsAtBoard({ pointer: { x: 900, y: 150 }, targets })).toBe(false);
  });

  it("has nothing to point at on a board with no targets", () => {
    expect(pointsAtBoard({ pointer: { x: 0, y: 0 }, targets: [] })).toBe(false);
  });
});
