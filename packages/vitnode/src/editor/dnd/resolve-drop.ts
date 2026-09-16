import type { BlockAllowedSpec } from "../../blocks/types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { isBlockAllowed } from "../../blocks/registry";

export const ZONE_DROPPABLE_PREFIX = "vitnode-editor-zone:";

export interface EditorDragSource {
  blockId: string;
  index: number;
  type: string;
  zoneId: string;
}

export interface EditorDropTarget {
  blockId: null | string;
  index: null | number;
  zoneId: string;
}

export interface ResolveDropArgs {
  allowedBlocks: BlockAllowedSpec | undefined;
  source: EditorDragSource;
  target: EditorDropTarget | null;
  targetBlockCount: number;
}

export interface ResolvedDrop {
  blockId: string;
  toIndex: number;
  toZoneId: string;
}

export const zoneDroppableId = (zoneId: string): string =>
  `${ZONE_DROPPABLE_PREFIX}${zoneId}`;

export const zoneIdFromDroppableId = (droppableId: string): null | string =>
  droppableId.startsWith(ZONE_DROPPABLE_PREFIX)
    ? droppableId.slice(ZONE_DROPPABLE_PREFIX.length)
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

  const { index, type, zoneId } = record;

  if (
    typeof index !== "number" ||
    typeof type !== "string" ||
    typeof zoneId !== "string"
  ) {
    return null;
  }

  return { blockId: draggableId, index, type, zoneId };
};

export const readDropTarget = (
  droppableId: string,
  data: unknown,
): EditorDropTarget | null => {
  const zoneId = zoneIdFromDroppableId(droppableId);
  if (zoneId !== null) return { blockId: null, index: null, zoneId };

  const source = readDragSource(droppableId, data);
  if (!source) return null;

  return {
    blockId: source.blockId,
    index: source.index,
    zoneId: source.zoneId,
  };
};

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

export const resolveDrop = ({
  allowedBlocks,
  source,
  target,
  targetBlockCount,
}: ResolveDropArgs): null | ResolvedDrop => {
  if (!target) return null;

  if (!isBlockAllowed(allowedBlocks ?? BLOCK_WILDCARD, source.type))
    return null;

  if (target.blockId !== null && target.blockId === source.blockId) return null;

  const sameZone = target.zoneId === source.zoneId;
  const lastIndex = Math.max(
    sameZone ? targetBlockCount - 1 : targetBlockCount,
    0,
  );
  const toIndex =
    target.index === null
      ? lastIndex
      : Math.min(Math.max(target.index, 0), lastIndex);

  if (sameZone && toIndex === source.index) return null;

  return { blockId: source.blockId, toIndex, toZoneId: target.zoneId };
};
