import type { BlockAllowedSpec } from "../../blocks/types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { isBlockAllowed } from "../../blocks/registry";

export const ZONE_DROPPABLE_PREFIX = "vitnode-editor-zone:";

export const CATALOG_DRAGGABLE_PREFIX = "vitnode-editor-catalog:";

export type EditorDragSource =
  | {
      blockId: string;
      index: number;
      kind: "existing-block";
      type: string;
      zoneId: string;
    }
  | { kind: "catalog-block"; type: string };

export type EditorDropEdge = "after" | "before";

export interface EditorDropIndicator {
  blockId: string;
  edge: EditorDropEdge;
}

export interface DropPlacement {
  indicator: EditorDropIndicator | null;
  position: number;
  total: number;
}

export interface EditorDropTarget {
  blockId: null | string;
  edge: EditorDropEdge | null;
  index: null | number;
  zoneId: string;
}

export interface ResolveDropArgs {
  allowedBlocks: BlockAllowedSpec | undefined;
  source: EditorDragSource;
  target: EditorDropTarget | null;
  targetBlockCount: number;
}

export type ResolvedDrop =
  | { blockId: string; kind: "move"; toIndex: number; toZoneId: string }
  | { kind: "insert"; toIndex: number; toZoneId: string; type: string };

export const zoneDroppableId = (zoneId: string): string =>
  `${ZONE_DROPPABLE_PREFIX}${zoneId}`;

export const zoneIdFromDroppableId = (droppableId: string): null | string =>
  droppableId.startsWith(ZONE_DROPPABLE_PREFIX)
    ? droppableId.slice(ZONE_DROPPABLE_PREFIX.length)
    : null;

export const catalogDraggableId = (type: string): string =>
  `${CATALOG_DRAGGABLE_PREFIX}${type}`;

export const catalogTypeFromDraggableId = (
  draggableId: string,
): null | string =>
  draggableId.startsWith(CATALOG_DRAGGABLE_PREFIX)
    ? draggableId.slice(CATALOG_DRAGGABLE_PREFIX.length)
    : null;

const asRecord = (value: unknown): null | Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const readDragSource = (
  draggableId: string,
  data: unknown,
): EditorDragSource | null => {
  const record = asRecord(data);
  if (!record) return null;

  const { index, kind, type, zoneId } = record;
  if (typeof type !== "string" || type === "") return null;

  if (kind === "catalog-block") return { kind: "catalog-block", type };

  if (
    kind !== "existing-block" ||
    typeof index !== "number" ||
    typeof zoneId !== "string"
  ) {
    return null;
  }

  return { blockId: draggableId, index, kind: "existing-block", type, zoneId };
};

export const readDropTarget = (
  droppableId: string,
  data: unknown,
  edge: EditorDropEdge | null,
): EditorDropTarget | null => {
  const zoneId = zoneIdFromDroppableId(droppableId);
  if (zoneId !== null)
    return { blockId: null, edge: null, index: null, zoneId };

  if (catalogTypeFromDraggableId(droppableId) !== null) return null;

  const source = readDragSource(droppableId, data);
  if (source?.kind !== "existing-block") return null;

  return {
    blockId: source.blockId,
    edge,
    index: source.index,
    zoneId: source.zoneId,
  };
};

export const dropEdgeFor = ({
  pointerY,
  rect,
}: {
  pointerY: number;
  rect: { height: number; top: number };
}): EditorDropEdge =>
  pointerY < rect.top + rect.height / 2 ? "before" : "after";

export const preferBlockCollisions = <
  TCollision extends { id: number | string },
>(
  collisions: readonly TCollision[],
): TCollision[] => {
  const blocks = collisions.filter(
    collision => zoneIdFromDroppableId(String(collision.id)) === null,
  );

  return blocks.length > 0 ? blocks : [...collisions];
};

const clamp = (value: number, max: number): number =>
  Math.min(Math.max(value, 0), max);

export const resolveDrop = ({
  allowedBlocks,
  source,
  target,
  targetBlockCount,
}: ResolveDropArgs): null | ResolvedDrop => {
  if (!target) return null;

  if (!isBlockAllowed(allowedBlocks ?? BLOCK_WILDCARD, source.type))
    return null;

  if (source.kind === "catalog-block") {
    const toIndex =
      target.index === null
        ? targetBlockCount
        : clamp(
            target.index + (target.edge === "after" ? 1 : 0),
            targetBlockCount,
          );

    return {
      kind: "insert",
      toIndex,
      toZoneId: target.zoneId,
      type: source.type,
    };
  }

  if (target.blockId !== null && target.blockId === source.blockId) return null;

  const sameZone = target.zoneId === source.zoneId;
  const lastIndex = Math.max(
    sameZone ? targetBlockCount - 1 : targetBlockCount,
    0,
  );

  const landing = (): number => {
    if (target.index === null) return lastIndex;
    if (target.edge === null) return clamp(target.index, lastIndex);

    const removed =
      sameZone && target.index > source.index ? target.index - 1 : target.index;

    return clamp(removed + (target.edge === "after" ? 1 : 0), lastIndex);
  };

  const toIndex = landing();
  if (sameZone && toIndex === source.index) return null;

  return {
    blockId: source.blockId,
    kind: "move",
    toIndex,
    toZoneId: target.zoneId,
  };
};

export const dropPlacement = ({
  blockIds,
  overBlockId,
  resolved,
}: {
  blockIds: readonly string[];
  overBlockId: null | string;
  resolved: ResolvedDrop;
}): DropPlacement => {
  const remaining =
    resolved.kind === "move"
      ? blockIds.filter(blockId => blockId !== resolved.blockId)
      : blockIds;
  const gap = clamp(resolved.toIndex, remaining.length);

  const indicator = (): EditorDropIndicator | null => {
    if (remaining.length === 0) return null;

    const overIndex =
      overBlockId === null ? -1 : remaining.indexOf(overBlockId);

    if (overIndex === gap) return { blockId: remaining[gap], edge: "before" };
    if (overIndex === gap - 1)
      return { blockId: remaining[overIndex], edge: "after" };

    return gap === remaining.length
      ? { blockId: remaining[gap - 1], edge: "after" }
      : { blockId: remaining[gap], edge: "before" };
  };

  return {
    indicator: indicator(),
    position: gap + 1,
    total: remaining.length + 1,
  };
};
