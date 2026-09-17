// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EditorDropTarget } from "./resolve-drop";

import {
  BLOCK_DRAGGABLE_PREFIX,
  blockDraggableId,
  blockRefFromDraggableId,
  CATALOG_DRAGGABLE_PREFIX,
  catalogDraggableId,
  dropEdgeFor,
  dropPlacement,
  isZoneDroppableId,
  preferBlockCollisions,
  readDragSource,
  readDropTarget,
  resolveDrop,
  ZONE_DROPPABLE_PREFIX,
  zoneDroppableId,
} from "./resolve-drop";

const source = (
  partial: Partial<{
    blockId: string;
    index: number;
    type: string;
    zoneId: string;
  }> = {},
) =>
  ({
    blockId: "block-a",
    index: 0,
    kind: "existing-block",
    type: "core:hero",
    zoneId: "page:main",
    ...partial,
  }) as const;

const fromCatalog = (type = "core:hero") =>
  ({ kind: "catalog-block", type }) as const;

const onBlock = (
  partial: Partial<EditorDropTarget> = {},
): EditorDropTarget => ({
  blockId: "block-b",
  edge: null,
  index: 1,
  zoneId: "page:main",
  ...partial,
});

const onZone = (zoneId: string): EditorDropTarget => ({
  blockId: null,
  edge: null,
  index: null,
  zoneId,
});

const decodedSuffix = (id: string, prefix: string): string =>
  decodeURIComponent(id.slice(prefix.length));

describe("zone droppable ids", () => {
  it("round-trips a zone id", () => {
    expect(
      decodedSuffix(zoneDroppableId("page:main"), ZONE_DROPPABLE_PREFIX),
    ).toBe("page:main");
  });

  it("does not claim a block id", () => {
    expect(isZoneDroppableId("01J0000000AAAAAAAAAAAAAAAA")).toBe(false);
  });
});

describe("catalog draggable ids", () => {
  it("round-trips a block type", () => {
    expect(
      decodedSuffix(catalogDraggableId("core:hero"), CATALOG_DRAGGABLE_PREFIX),
    ).toBe("core:hero");
  });

  it("cannot be mistaken for a block instance or a zone", () => {
    expect(blockRefFromDraggableId(catalogDraggableId("core:hero"))).toBeNull();
    expect(isZoneDroppableId(catalogDraggableId("core:hero"))).toBe(false);
    expect(blockRefFromDraggableId(zoneDroppableId("page:main"))).toBeNull();
  });
});

describe("zone-aware identity", () => {
  it("gives the same block a different draggable id in each zone", () => {
    expect(
      blockDraggableId({ blockId: "block-x", zoneId: "page:main" }),
    ).not.toBe(blockDraggableId({ blockId: "block-x", zoneId: "page:aside" }));
  });

  it("round-trips a block back to the zone it was dragged from", () => {
    expect(
      blockRefFromDraggableId(
        blockDraggableId({ blockId: "block-x", zoneId: "page:main" }),
      ),
    ).toEqual({ blockId: "block-x", zoneId: "page:main" });

    expect(
      blockRefFromDraggableId(
        blockDraggableId({ blockId: "block-x", zoneId: "page:aside" }),
      ),
    ).toEqual({ blockId: "block-x", zoneId: "page:aside" });
  });

  it("round-trips ids that carry separators, escapes and spaces", () => {
    const ref = {
      blockId: "block/one:two%three four",
      zoneId: "page:main/left 50%",
    };

    expect(blockRefFromDraggableId(blockDraggableId(ref))).toEqual(ref);
    expect(
      decodedSuffix(zoneDroppableId(ref.zoneId), ZONE_DROPPABLE_PREFIX),
    ).toBe(ref.zoneId);
    expect(
      decodedSuffix(
        catalogDraggableId("core:hero/fancy 100%"),
        CATALOG_DRAGGABLE_PREFIX,
      ),
    ).toBe("core:hero/fancy 100%");
  });

  it("reads a block ref out of nothing else", () => {
    expect(blockRefFromDraggableId(zoneDroppableId("page:main"))).toBeNull();
    expect(blockRefFromDraggableId(catalogDraggableId("core:hero"))).toBeNull();
    expect(
      blockRefFromDraggableId(`${BLOCK_DRAGGABLE_PREFIX}block-x`),
    ).toBeNull();
  });

  it("knows a zone droppable from everything else it might collide with", () => {
    expect(isZoneDroppableId(zoneDroppableId("page:main"))).toBe(true);
    expect(
      isZoneDroppableId(
        blockDraggableId({ blockId: "block-x", zoneId: "page:main" }),
      ),
    ).toBe(false);
    expect(isZoneDroppableId(catalogDraggableId("core:hero"))).toBe(false);
  });

  it("still prefers block collisions over the zone that contains them", () => {
    const block = {
      id: blockDraggableId({ blockId: "block-b", zoneId: "page:main" }),
    };

    expect(
      preferBlockCollisions([{ id: zoneDroppableId("page:main") }, block]),
    ).toEqual([block]);
  });

  it("takes a drag source's identity from the payload, not the element id", () => {
    const payload = {
      blockId: "block-x",
      index: 0,
      kind: "existing-block",
      type: "core:hero",
    };

    expect(readDragSource({ ...payload, zoneId: "page:main" })).toEqual({
      ...payload,
      zoneId: "page:main",
    });
    expect(readDragSource({ ...payload, zoneId: "page:aside" })).toEqual({
      ...payload,
      zoneId: "page:aside",
    });
    expect(readDragSource({ ...payload, zoneId: "page:main" })).not.toEqual(
      readDragSource({ ...payload, zoneId: "page:aside" }),
    );
  });

  it("refuses a block payload missing any part of its identity", () => {
    expect(
      readDragSource({
        index: 0,
        kind: "existing-block",
        type: "core:hero",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(
      readDragSource({
        blockId: "block-x",
        index: 0,
        kind: "existing-block",
        type: "core:hero",
      }),
    ).toBeNull();
    expect(
      readDragSource({
        blockId: "block-x",
        kind: "existing-block",
        type: "core:hero",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(
      readDragSource({
        blockId: "block-x",
        index: 0,
        kind: "existing-block",
        zoneId: "page:main",
      }),
    ).toBeNull();
  });

  it("takes a drop target from the payload a zone or a block carries", () => {
    expect(
      readDropTarget({ kind: "zone", zoneId: "page:aside" }, null),
    ).toEqual({
      blockId: null,
      edge: null,
      index: null,
      zoneId: "page:aside",
    });
    expect(
      readDropTarget(
        {
          blockId: "block-x",
          index: 2,
          kind: "existing-block",
          type: "core:hero",
          zoneId: "page:aside",
        },
        "after",
      ),
    ).toEqual({
      blockId: "block-x",
      edge: "after",
      index: 2,
      zoneId: "page:aside",
    });
    expect(
      readDropTarget({ kind: "catalog-block", type: "core:hero" }, "after"),
    ).toBeNull();
    expect(readDropTarget("page:aside", "after")).toBeNull();
  });
});

describe("readDragSource", () => {
  it("reads the payload a sortable block carries", () => {
    expect(
      readDragSource({
        blockId: "block-a",
        index: 2,
        kind: "existing-block",
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toEqual({
      blockId: "block-a",
      index: 2,
      kind: "existing-block",
      type: "core:text",
      zoneId: "page:main",
    });
  });

  it("reads the payload a catalog entry carries", () => {
    expect(
      readDragSource({ kind: "catalog-block", type: "core:text" }),
    ).toEqual({ kind: "catalog-block", type: "core:text" });
  });

  it("refuses a payload that is not a block", () => {
    expect(readDragSource(undefined)).toBeNull();
    expect(readDragSource([1, 2])).toBeNull();
    expect(readDragSource({ zoneId: "page:main" })).toBeNull();
    expect(
      readDragSource({
        blockId: "block-a",
        index: "2",
        kind: "existing-block",
        type: "core:text",
        zoneId: "z",
      }),
    ).toBeNull();
  });

  it("refuses a payload whose kind it does not know", () => {
    expect(
      readDragSource({
        blockId: "block-a",
        index: 2,
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(
      readDragSource({
        blockId: "block-a",
        index: 2,
        kind: "block",
        type: "core:text",
        zoneId: "page:main",
      }),
    ).toBeNull();
    expect(readDragSource({ kind: "catalog-block" })).toBeNull();
    expect(readDragSource({ kind: "catalog-block", type: "" })).toBeNull();
  });
});

describe("readDropTarget", () => {
  it("reads a zone droppable as an append target with no edge", () => {
    expect(
      readDropTarget({ kind: "zone", zoneId: "page:aside" }, "after"),
    ).toEqual({
      blockId: null,
      edge: null,
      index: null,
      zoneId: "page:aside",
    });
  });

  it("reads a sortable block as an insert-at-index target", () => {
    expect(
      readDropTarget(
        {
          blockId: "block-b",
          index: 3,
          kind: "existing-block",
          type: "core:cta",
          zoneId: "page:main",
        },
        "before",
      ),
    ).toEqual({
      blockId: "block-b",
      edge: "before",
      index: 3,
      zoneId: "page:main",
    });
  });

  it("never treats a catalog entry as somewhere to drop", () => {
    expect(
      readDropTarget({ kind: "catalog-block", type: "core:hero" }, "before"),
    ).toBeNull();
  });

  it("refuses anything else", () => {
    expect(readDropTarget(null, null)).toBeNull();
    expect(readDropTarget({ kind: "zone" }, null)).toBeNull();
  });
});

describe("dropEdgeFor", () => {
  it("is before above the midpoint and after below it", () => {
    const rect = { height: 100, top: 200 };

    expect(dropEdgeFor({ pointerY: 220, rect })).toBe("before");
    expect(dropEdgeFor({ pointerY: 250, rect })).toBe("after");
    expect(dropEdgeFor({ pointerY: 280, rect })).toBe("after");
  });
});

describe("preferBlockCollisions", () => {
  it("prefers block collisions over the zone that contains them", () => {
    const b = { id: blockDraggableId({ blockId: "b", zoneId: "page:main" }) };
    const c = { id: blockDraggableId({ blockId: "c", zoneId: "page:main" }) };

    expect(
      preferBlockCollisions([{ id: zoneDroppableId("page:main") }, b, c]),
    ).toEqual([b, c]);
  });

  it("falls back to the zone when no block is hit", () => {
    const collisions = [{ id: zoneDroppableId("page:main") }];

    expect(preferBlockCollisions(collisions)).toEqual(collisions);
  });

  it("falls back rather than ranking an id it cannot read as a block", () => {
    const collisions = [
      { id: zoneDroppableId("page:main") },
      { id: "something-else" },
    ];

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
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:main",
    });
  });

  it("appends to the end of its own zone, accounting for its own removal", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onZone("page:main"),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:main",
    });
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
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:aside",
    });
  });

  it("lands at index 0 in an empty zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 0,
      toZoneId: "page:aside",
    });
  });

  it("clamps an index the target zone cannot hold", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source(),
        target: onBlock({ blockId: "block-z", index: 9, zoneId: "page:aside" }),
        targetBlockCount: 2,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:aside",
    });
  });

  it("accepts a type the target zone allows by namespace", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: source({ type: "core:hero" }),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 0,
      toZoneId: "page:aside",
    });
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
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 0,
      toZoneId: "page:aside",
    });
  });
});

describe("resolveDrop, by pointer edge", () => {
  it("lands a block above the one it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onBlock({ blockId: "block-c", edge: "before", index: 2 }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 1,
      toZoneId: "page:main",
    });
  });

  it("lands a block below the one it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onBlock({ blockId: "block-c", edge: "after", index: 2 }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:main",
    });
  });

  it("counts an upward move against the list it was removed from", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 3 }),
        target: onBlock({ blockId: "block-b", edge: "before", index: 1 }),
        targetBlockCount: 4,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 1,
      toZoneId: "page:main",
    });

    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 3 }),
        target: onBlock({ blockId: "block-b", edge: "after", index: 1 }),
        targetBlockCount: 4,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:main",
    });
  });

  it("drops nothing when the edge names the place it already sits", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 1 }),
        target: onBlock({ blockId: "block-b", edge: "after", index: 0 }),
        targetBlockCount: 3,
      }),
    ).toBeNull();
  });

  it("makes room for a block arriving from another zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ index: 0 }),
        target: onBlock({
          blockId: "block-z",
          edge: "after",
          index: 1,
          zoneId: "page:aside",
        }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-a",
      fromZoneId: "page:main",
      kind: "move",
      toIndex: 2,
      toZoneId: "page:aside",
    });
  });
});

describe("resolveDrop, when the same block id lives in two zones", () => {
  it("moves the copy that was dragged, not the one in the target zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ blockId: "block-x", index: 0, zoneId: "page:aside" }),
        target: onBlock({
          blockId: "block-b",
          edge: "before",
          index: 1,
          zoneId: "page:main",
        }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-x",
      fromZoneId: "page:aside",
      kind: "move",
      toIndex: 1,
      toZoneId: "page:main",
    });
  });

  it("treats a drop onto the other zone's namesake as a real move", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ blockId: "block-x", index: 0, zoneId: "page:aside" }),
        target: onBlock({
          blockId: "block-x",
          edge: "after",
          index: 2,
          zoneId: "page:main",
        }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      blockId: "block-x",
      fromZoneId: "page:aside",
      kind: "move",
      toIndex: 3,
      toZoneId: "page:main",
    });
  });

  it("still drops nothing onto itself within its own zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: source({ blockId: "block-x", index: 2, zoneId: "page:main" }),
        target: onBlock({
          blockId: "block-x",
          edge: "after",
          index: 2,
          zoneId: "page:main",
        }),
        targetBlockCount: 3,
      }),
    ).toBeNull();
  });

  it("leaves the target zone's namesake in the list it is landing among", () => {
    expect(
      dropPlacement({
        blockIds: ["block-w", "block-x", "block-y"],
        overBlockId: "block-x",
        resolved: {
          blockId: "block-x",
          fromZoneId: "page:aside",
          kind: "move",
          toIndex: 1,
          toZoneId: "page:main",
        },
        zoneId: "page:main",
      }),
    ).toEqual({
      indicator: { blockId: "block-x", edge: "before", zoneId: "page:main" },
      position: 2,
      total: 4,
    });

    expect(
      dropPlacement({
        blockIds: ["block-w", "block-x", "block-y"],
        overBlockId: "block-y",
        resolved: {
          blockId: "block-x",
          fromZoneId: "page:main",
          kind: "move",
          toIndex: 1,
          toZoneId: "page:main",
        },
        zoneId: "page:main",
      }),
    ).toEqual({
      indicator: { blockId: "block-y", edge: "before", zoneId: "page:main" },
      position: 2,
      total: 3,
    });
  });
});

describe("resolveDrop, from the catalog", () => {
  it("inserts before the block it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onBlock({ edge: "before", index: 1 }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 1,
      toZoneId: "page:main",
      type: "core:text",
    });
  });

  it("inserts after the block it was dropped on", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog("core:text"),
        target: onBlock({ edge: "after", index: 1 }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 2,
      toZoneId: "page:main",
      type: "core:text",
    });
  });

  it("never adjusts for a removal, because nothing is removed", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onBlock({ edge: "before", index: 2 }),
        targetBlockCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 2,
      toZoneId: "page:main",
      type: "core:hero",
    });
  });

  it("appends when it is dropped on the zone itself", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onZone("page:main"),
        targetBlockCount: 3,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 3,
      toZoneId: "page:main",
      type: "core:hero",
    });
  });

  it("lands at index 0 in an empty zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 0,
      toZoneId: "page:aside",
      type: "core:hero",
    });
  });

  it("clamps an index past the end of the zone", () => {
    expect(
      resolveDrop({
        allowedBlocks: "*",
        source: fromCatalog(),
        target: onBlock({ edge: "after", index: 9 }),
        targetBlockCount: 2,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 2,
      toZoneId: "page:main",
      type: "core:hero",
    });
  });

  it("is refused by the target zone's allowlist", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["core:*"],
        source: fromCatalog("example:callout"),
        target: onZone("page:main"),
        targetBlockCount: 0,
      }),
    ).toBeNull();
  });

  it("is accepted when the allowlist names its namespace", () => {
    expect(
      resolveDrop({
        allowedBlocks: ["example:*"],
        source: fromCatalog("example:callout"),
        target: onZone("page:main"),
        targetBlockCount: 1,
      }),
    ).toEqual({
      kind: "insert",
      toIndex: 1,
      toZoneId: "page:main",
      type: "example:callout",
    });
  });
});

const ids = ["block-a", "block-b", "block-c"];

const placeFor = ({
  allowedBlocks = "*",
  blockIds = ids,
  source: dragged,
  target,
  targetBlockCount = blockIds.length,
}: {
  allowedBlocks?: "*" | readonly string[];
  blockIds?: readonly string[];
  source: Parameters<typeof resolveDrop>[0]["source"];
  target: EditorDropTarget;
  targetBlockCount?: number;
}) => {
  const resolved = resolveDrop({
    allowedBlocks,
    source: dragged,
    target,
    targetBlockCount,
  });
  if (resolved === null) return null;

  return dropPlacement({
    blockIds,
    overBlockId: target.blockId,
    resolved,
    zoneId: target.zoneId,
  });
};

describe("dropPlacement, from the catalog", () => {
  it("keeps the pointer's own edge on the block it is over", () => {
    expect(
      placeFor({
        source: fromCatalog("core:text"),
        target: onBlock({ edge: "before", index: 1 }),
      }),
    ).toEqual({
      indicator: { blockId: "block-b", edge: "before", zoneId: "page:main" },
      position: 2,
      total: 4,
    });

    expect(
      placeFor({
        source: fromCatalog("core:text"),
        target: onBlock({ edge: "after", index: 1 }),
      }),
    ).toEqual({
      indicator: { blockId: "block-b", edge: "after", zoneId: "page:main" },
      position: 3,
      total: 4,
    });
  });

  it("points after the last block when the zone itself is the target", () => {
    expect(
      placeFor({ source: fromCatalog(), target: onZone("page:main") }),
    ).toEqual({
      indicator: { blockId: "block-c", edge: "after", zoneId: "page:main" },
      position: 4,
      total: 4,
    });
  });

  it("shows no line in an empty zone, because there is nothing to draw it against", () => {
    expect(
      placeFor({
        blockIds: [],
        source: fromCatalog(),
        target: onZone("page:aside"),
        targetBlockCount: 0,
      }),
    ).toEqual({ indicator: null, position: 1, total: 1 });
  });
});

describe("dropPlacement, moving a block", () => {
  it("counts the landing against the list the block was removed from", () => {
    expect(
      placeFor({
        source: source({ index: 0 }),
        target: onBlock({ blockId: "block-c", edge: "after", index: 2 }),
      }),
    ).toEqual({
      indicator: { blockId: "block-c", edge: "after", zoneId: "page:main" },
      position: 3,
      total: 3,
    });
  });

  it("never draws the line against the block being dragged", () => {
    const placement = placeFor({
      source: source({ blockId: "block-b", index: 1 }),
      target: onBlock({ blockId: "block-c", edge: "after", index: 2 }),
    });

    expect(placement?.indicator).toEqual({
      blockId: "block-c",
      edge: "after",
      zoneId: "page:main",
    });
  });

  it("places a keyboard drag, which carries no pointer edge at all", () => {
    expect(
      placeFor({
        source: source({ index: 0 }),
        target: onBlock({ blockId: "block-c", edge: null, index: 2 }),
      }),
    ).toEqual({
      indicator: { blockId: "block-c", edge: "after", zoneId: "page:main" },
      position: 3,
      total: 3,
    });

    expect(
      placeFor({
        source: source({ blockId: "block-c", index: 2 }),
        target: onBlock({ blockId: "block-a", edge: null, index: 0 }),
      }),
    ).toEqual({
      indicator: { blockId: "block-a", edge: "before", zoneId: "page:main" },
      position: 1,
      total: 3,
    });
  });

  it("shows nothing at all when the drop would change nothing", () => {
    expect(
      placeFor({
        source: source({ index: 1 }),
        target: onBlock({ blockId: "block-b", edge: "after", index: 0 }),
      }),
    ).toBeNull();
  });

  it("shows nothing at all when the zone refuses the block", () => {
    expect(
      placeFor({
        allowedBlocks: ["core:*"],
        source: source({ type: "example:callout" }),
        target: onBlock({ blockId: "block-b", edge: "before", index: 1 }),
      }),
    ).toBeNull();
  });

  it("makes room for a block arriving from another zone", () => {
    expect(
      placeFor({
        blockIds: ["block-x", "block-y"],
        source: source({ index: 0 }),
        target: onBlock({
          blockId: "block-y",
          edge: "after",
          index: 1,
          zoneId: "page:aside",
        }),
        targetBlockCount: 2,
      }),
    ).toEqual({
      indicator: { blockId: "block-y", edge: "after", zoneId: "page:aside" },
      position: 3,
      total: 3,
    });
  });
});

describe("dropPlacement, on its own", () => {
  it("falls back to the gap when the block it is over is not in the list", () => {
    expect(
      dropPlacement({
        blockIds: ids,
        overBlockId: "block-gone",
        resolved: {
          kind: "insert",
          toIndex: 1,
          toZoneId: "page:main",
          type: "core:text",
        },
        zoneId: "page:main",
      }),
    ).toEqual({
      indicator: { blockId: "block-b", edge: "before", zoneId: "page:main" },
      position: 2,
      total: 4,
    });
  });

  it("clamps a landing index the list cannot hold", () => {
    expect(
      dropPlacement({
        blockIds: ids,
        overBlockId: null,
        resolved: {
          kind: "insert",
          toIndex: 9,
          toZoneId: "page:main",
          type: "core:text",
        },
        zoneId: "page:main",
      }),
    ).toEqual({
      indicator: { blockId: "block-c", edge: "after", zoneId: "page:main" },
      position: 4,
      total: 4,
    });
  });
});
