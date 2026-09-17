import type { BlockAllowedSpec } from "../../blocks/types";
import type {
  EditorContainerRef,
  EditorNodeKind,
  EditorNodeRef,
} from "../state/types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { isBlockAllowed } from "../../blocks/registry";

export const ZONE_DROPPABLE_PREFIX = "vitnode-editor-zone:";

export const AREA_DROPPABLE_PREFIX = "vitnode-editor-area:";

export const CATALOG_DRAGGABLE_PREFIX = "vitnode-editor-catalog:";

export const NODE_DRAGGABLE_PREFIX = "vitnode-editor-node:";

export type EditorDragSource =
  | {
      container: EditorContainerRef;
      index: number;
      kind: "existing-area";
      nodeId: string;
    }
  | {
      container: EditorContainerRef;
      index: number;
      kind: "existing-block";
      nodeId: string;
      type: string;
    }
  | { kind: "catalog-block"; type: string };

export type EditorDropEdge = "after" | "before";

export interface EditorDropIndicator {
  areaId: null | string;
  edge: EditorDropEdge;
  nodeId: string;
  zoneId: string;
}

export interface DropPlacement {
  indicator: EditorDropIndicator | null;
  position: number;
  total: number;
}

export interface EditorDropTarget {
  container: EditorContainerRef;
  edge: EditorDropEdge | null;
  index: null | number;
  kind: EditorNodeKind | null;
  nodeId: null | string;
}

export type EditorDropRejection = "nested-area" | "not-allowed";

export interface ResolveDropArgs {
  allowedBlocks: BlockAllowedSpec | undefined;
  source: EditorDragSource;
  target: EditorDropTarget | null;
  targetNodeCount: number;
}

export type ResolvedDrop =
  | {
      from: EditorContainerRef;
      kind: "move";
      nodeId: string;
      to: EditorContainerRef;
      toIndex: number;
    }
  | { kind: "insert"; to: EditorContainerRef; toIndex: number; type: string };

const encode = (value: string): string => encodeURIComponent(value);

const containerSuffix = ({ areaId, zoneId }: EditorContainerRef): string =>
  `${encode(zoneId)}/${areaId === null ? "" : encode(areaId)}`;

export const zoneDroppableId = (zoneId: string): string =>
  `${ZONE_DROPPABLE_PREFIX}${encode(zoneId)}`;

export const isZoneDroppableId = (droppableId: string): boolean =>
  droppableId.startsWith(ZONE_DROPPABLE_PREFIX);

export const areaDroppableId = (container: EditorContainerRef): string =>
  `${AREA_DROPPABLE_PREFIX}${containerSuffix(container)}`;

export const isAreaDroppableId = (droppableId: string): boolean =>
  droppableId.startsWith(AREA_DROPPABLE_PREFIX);

export const isContainerDroppableId = (droppableId: string): boolean =>
  isZoneDroppableId(droppableId) || isAreaDroppableId(droppableId);

export const catalogDraggableId = (type: string): string =>
  `${CATALOG_DRAGGABLE_PREFIX}${encode(type)}`;

export const nodeDraggableId = ({
  areaId,
  kind,
  nodeId,
  zoneId,
}: EditorNodeRef): string =>
  `${NODE_DRAGGABLE_PREFIX}${encode(kind)}/${containerSuffix({ areaId, zoneId })}/${encode(nodeId)}`;

export const nodeRefFromDraggableId = (
  draggableId: string,
): EditorNodeRef | null => {
  if (!draggableId.startsWith(NODE_DRAGGABLE_PREFIX)) return null;

  const parts = draggableId.slice(NODE_DRAGGABLE_PREFIX.length).split("/");
  if (parts.length !== 4) return null;

  const [kind, zoneId, areaId, nodeId] = parts;
  if (kind !== "area" && kind !== "block") return null;
  if (zoneId === "" || nodeId === "") return null;

  return {
    areaId: areaId === "" ? null : decodeURIComponent(areaId),
    kind,
    nodeId: decodeURIComponent(nodeId),
    zoneId: decodeURIComponent(zoneId),
  };
};

const asRecord = (value: unknown): null | Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readContainer = (
  record: Record<string, unknown>,
): EditorContainerRef | null => {
  const { areaId, zoneId } = record;

  if (typeof zoneId !== "string" || zoneId === "") return null;

  if (areaId === null || areaId === undefined || areaId === "") {
    return { areaId: null, zoneId };
  }

  return typeof areaId === "string" ? { areaId, zoneId } : null;
};

export const readDragSource = (data: unknown): EditorDragSource | null => {
  const record = asRecord(data);
  if (!record) return null;

  const { index, kind, nodeId, type } = record;

  if (kind === "catalog-block") {
    return typeof type === "string" && type !== ""
      ? { kind: "catalog-block", type }
      : null;
  }

  if (kind !== "existing-area" && kind !== "existing-block") return null;

  const container = readContainer(record);
  if (!container || typeof nodeId !== "string" || typeof index !== "number") {
    return null;
  }

  if (kind === "existing-area") {
    return { container, index, kind, nodeId };
  }

  return typeof type === "string" && type !== ""
    ? { container, index, kind, nodeId, type }
    : null;
};

export const readDropTarget = (
  data: unknown,
  edge: EditorDropEdge | null,
): EditorDropTarget | null => {
  const record = asRecord(data);
  if (!record) return null;

  if (record.kind === "zone" || record.kind === "area-container") {
    const container = readContainer(record);
    if (!container) return null;

    return record.kind === "zone" && container.areaId !== null
      ? null
      : { container, edge: null, index: null, kind: null, nodeId: null };
  }

  const source = readDragSource(record);
  if (source === null || source.kind === "catalog-block") return null;

  return {
    container: source.container,
    edge,
    index: source.index,
    kind: source.kind === "existing-area" ? "area" : "block",
    nodeId: source.nodeId,
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

export const preferInnerCollisions = <
  TCollision extends { id: number | string },
>(
  collisions: readonly TCollision[],
): TCollision[] => {
  const refs = collisions.map(
    collision =>
      [collision, nodeRefFromDraggableId(String(collision.id))] as const,
  );

  const inArea = refs.filter(([, ref]) => ref !== null && ref.areaId !== null);
  if (inArea.length > 0) return inArea.map(([collision]) => collision);

  const areas = collisions.filter(collision =>
    isAreaDroppableId(String(collision.id)),
  );
  if (areas.length > 0) return areas;

  const atRoot = refs.filter(([, ref]) => ref !== null);
  if (atRoot.length > 0) return atRoot.map(([collision]) => collision);

  return [...collisions];
};

const clamp = (value: number, max: number): number =>
  Math.min(Math.max(value, 0), max);

const sameContainer = (
  left: EditorContainerRef,
  right: EditorContainerRef,
): boolean => left.zoneId === right.zoneId && left.areaId === right.areaId;

export const dropRejection = ({
  allowedBlocks,
  source,
  target,
}: {
  allowedBlocks: BlockAllowedSpec | undefined;
  source: EditorDragSource;
  target: EditorDropTarget | null;
}): EditorDropRejection | null => {
  if (!target) return null;

  if (source.kind === "existing-area") {
    return target.container.areaId === null ? null : "nested-area";
  }

  return isBlockAllowed(allowedBlocks ?? BLOCK_WILDCARD, source.type)
    ? null
    : "not-allowed";
};

export const resolveDrop = ({
  allowedBlocks,
  source,
  target,
  targetNodeCount,
}: ResolveDropArgs): null | ResolvedDrop => {
  if (!target) return null;
  if (dropRejection({ allowedBlocks, source, target }) !== null) return null;

  if (source.kind === "catalog-block") {
    const toIndex =
      target.index === null
        ? targetNodeCount
        : clamp(
            target.index + (target.edge === "after" ? 1 : 0),
            targetNodeCount,
          );

    return {
      kind: "insert",
      to: target.container,
      toIndex,
      type: source.type,
    };
  }

  const same = sameContainer(target.container, source.container);

  if (same && target.nodeId === source.nodeId) return null;

  const lastIndex = Math.max(same ? targetNodeCount - 1 : targetNodeCount, 0);

  const landing = (): number => {
    if (target.index === null) return lastIndex;
    if (target.edge === null) return clamp(target.index, lastIndex);

    const removed =
      same && target.index > source.index ? target.index - 1 : target.index;

    return clamp(removed + (target.edge === "after" ? 1 : 0), lastIndex);
  };

  const toIndex = landing();
  if (same && toIndex === source.index) return null;

  return {
    from: source.container,
    kind: "move",
    nodeId: source.nodeId,
    to: target.container,
    toIndex,
  };
};

export const dropPlacement = ({
  container,
  nodeIds,
  overNodeId,
  resolved,
}: {
  container: EditorContainerRef;
  nodeIds: readonly string[];
  overNodeId: null | string;
  resolved: ResolvedDrop;
}): DropPlacement => {
  const remaining =
    resolved.kind === "move" && sameContainer(resolved.from, container)
      ? nodeIds.filter(nodeId => nodeId !== resolved.nodeId)
      : nodeIds;
  const gap = clamp(resolved.toIndex, remaining.length);

  const at = (index: number, edge: EditorDropEdge): EditorDropIndicator => ({
    areaId: container.areaId,
    edge,
    nodeId: remaining[index],
    zoneId: container.zoneId,
  });

  const indicator = (): EditorDropIndicator | null => {
    if (remaining.length === 0) return null;

    const overIndex = overNodeId === null ? -1 : remaining.indexOf(overNodeId);

    if (overIndex === gap) return at(gap, "before");
    if (overIndex === gap - 1) return at(overIndex, "after");

    return gap === remaining.length ? at(gap - 1, "after") : at(gap, "before");
  };

  return {
    indicator: indicator(),
    position: gap + 1,
    total: remaining.length + 1,
  };
};
