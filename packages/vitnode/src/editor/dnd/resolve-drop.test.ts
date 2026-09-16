// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EditorDragSource, EditorDropTarget } from "./resolve-drop";

import {
  preferBlockCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
  zoneDroppableId,
  zoneIdFromDroppableId,
} from "./resolve-drop";

const source = (partial: Partial<EditorDragSource> = {}): EditorDragSource => ({
  blockId: "block-a",
  index: 0,
  type: "core:hero",
  zoneId: "page:main",
  ...partial,
});

const onBlock = (
  partial: Partial<EditorDropTarget> = {},
): EditorDropTarget => ({
  blockId: "block-b",
  index: 1,
  zoneId: "page:main",
  ...partial,
});

const onZone = (zoneId: string): EditorDropTarget => ({
  blockId: null,
  index: null,
  zoneId,
});

describe("zone droppable ids", () => {
  it("round-trips a zone id", () => {
    expect(zoneIdFromDroppableId(zoneDroppableId("page:main"))).toBe(
      "page:main",
    );
  });

  it("does not claim a block id", () => {
    expect(zoneIdFromDroppableId("01J0000000AAAAAAAAAAAAAAAA")).toBeNull();
  });
});

describe("readDragSource", () => {
  it("reads the payload a sortable block carries", () => {
    expect(
      readDragSource("block-a", {
        index: 2,
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toEqual({
      blockId: "block-a",
      index: 2,
      type: "core:text",
      zoneId: "page:main",
    });
  });

  it("refuses a payload that is not a block", () => {
    expect(readDragSource("block-a", undefined)).toBeNull();
    expect(readDragSource("block-a", [1, 2])).toBeNull();
    expect(readDragSource("block-a", { zoneId: "page:main" })).toBeNull();
    expect(
      readDragSource("block-a", { index: "2", type: "core:text", zoneId: "z" }),
    ).toBeNull();
  });
});

describe("readDropTarget", () => {
  it("reads a zone droppable as an append target", () => {
    expect(
      readDropTarget(zoneDroppableId("page:aside"), { zoneId: "x" }),
    ).toEqual({ blockId: null, index: null, zoneId: "page:aside" });
  });

  it("reads a sortable block as an insert-at-index target", () => {
    expect(
      readDropTarget("block-b", {
        index: 3,
        type: "core:cta",
        zoneId: "page:main",
      }),
    ).toEqual({ blockId: "block-b", index: 3, zoneId: "page:main" });
  });

  it("refuses anything else", () => {
    expect(readDropTarget("block-b", null)).toBeNull();
  });
});

describe("preferBlockCollisions", () => {
  it("prefers block collisions over the zone that contains them", () => {
    expect(
      preferBlockCollisions([
        { id: zoneDroppableId("page:main") },
        { id: "block-b" },
        { id: "block-c" },
      ]),
    ).toEqual([{ id: "block-b" }, { id: "block-c" }]);
  });

  it("falls back to the zone when no block is hit", () => {
    const collisions = [{ id: zoneDroppableId("page:main") }];

    expect(preferBlockCollisions(collisions)).toEqual(collisions);
  });

  it("stays empty when nothing collides", () => {
    expect(preferBlockCollisions([])).toEqual([]);
  });
});

describe("resolveDrop", () => {
  it("drops nothing without a target", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source(),
        target: null,
        targetBlockCount: 3,
      }),
    ).toBeNull();
  });

  it("drops nothing on the dragged block itself", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onBlock({ blockId: "block-a", index: 1 }),
        targetBlockCount: 3,
      }),
    ).toBeNull();
  });

  it("moves to the index of the block it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onBlock({ blockId: "block-c", index: 2 }),
        targetBlockCount: 3,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 2, toZoneId: "page:main" });
  });

  it("appends to the end of its own zone, accounting for its own removal", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onZone("page:main"),
        targetBlockCount: 3,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 2, toZoneId: "page:main" });
  });

  it("drops nothing when the block is already where it would land", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 2 }),
        target: onZone("page:main"),
        targetBlockCount: 3,
      }),
    ).toBeNull();
  });

  it("appends past the last block of another zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onZone("page:aside"),
        targetBlockCount: 2,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 2, toZoneId: "page:aside" });
  });

  it("lands at index 0 in an empty zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 0, toZoneId: "page:aside" });
  });

  it("clamps an index the target zone cannot hold", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source(),
        target: onBlock({ blockId: "block-z", index: 9, zoneId: "page:aside" }),
        targetBlockCount: 2,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 2, toZoneId: "page:aside" });
  });

  it("accepts a type the target zone allows by namespace", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "core:hero" }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 0, toZoneId: "page:aside" });
  });

  it("refuses a type the target zone does not allow", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toBeNull();
  });

  it("treats a zone without an allowlist as open to every block", () => {
    expect(
      resolveDrop({
        allowedBlocks: undefined,
        source: source({ type: "example:callout" }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({ blockId: "block-a", toIndex: 0, toZoneId: "page:aside" });
  });
});
