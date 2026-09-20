import type { DropCapacity } from "../state/bounds";
import type {
  EditorContainerRef,
  EditorNodeKind,
  EditorNodeRef,
  TargetCapabilities,
} from "../state/types";

import {
  areaHasRoom,
  fitsRootNodeCap,
  fitsZoneMax,
  fitsZoneMin,
} from "../state/bounds";

export const ZONE_DROPPABLE_PREFIX = "vitnode-editor-zone:";

export const AREA_DROPPABLE_PREFIX = "vitnode-editor-area:";

export const CATALOG_DRAGGABLE_PREFIX = "vitnode-editor-catalog:";

export const AREA_CATALOG_DRAGGABLE_ID = "vitnode-editor-catalog-area";

export const NODE_DRAGGABLE_PREFIX = "vitnode-editor-node:";

export type EditorDragSource =
  | {
      childTypes: readonly string[];
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
  | { kind: "catalog-area" }
  | { kind: "catalog-block"; type: string };

/** A source that is being added to the page rather than moved within it. */
export type EditorCatalogSource = Extract<
  EditorDragSource,
  { kind: "catalog-area" | "catalog-block" }
>;

export const isCatalogSource = (
  source: EditorDragSource,
): source is EditorCatalogSource =>
  source.kind === "catalog-area" || source.kind === "catalog-block";

export type EditorDropEdge = "after" | "before";

export type EditorDropAxis = "horizontal" | "vertical";

export interface EditorDropIndicator {
  areaId: null | string;
  axis: EditorDropAxis;
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

export type EditorDropRejection =
  | "area-full"
  | "nested-area"
  | "not-allowed"
  | "not-registered"
  | "zone-full"
  | "zone-min";

export type { TargetCapabilities } from "../state/types";

export interface ResolveDropArgs {
  capabilities: TargetCapabilities;
  source: EditorDragSource;
  target: EditorDropTarget | null;
  targetNodeCount: number;
}

export interface DecideDropArgs extends ResolveDropArgs {
  capacity: DropCapacity;
}

export interface DropDecision {
  rejection: EditorDropRejection | null;
  resolved: null | ResolvedDrop;
}

export type ResolvedDrop =
  | {
      from: EditorContainerRef;
      kind: "move";
      nodeId: string;
      to: EditorContainerRef;
      toIndex: number;
    }
  | { kind: "insert"; to: EditorContainerRef; toIndex: number; type: string }
  | { kind: "insert-area"; to: EditorContainerRef; toIndex: number };

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

  if (kind === "catalog-area") return { kind: "catalog-area" };

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
    const { childTypes } = record;

    return {
      childTypes: Array.isArray(childTypes)
        ? childTypes.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
      container,
      index,
      kind,
      nodeId,
    };
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
  if (source === null || isCatalogSource(source)) return null;

  return {
    container: source.container,
    edge,
    index: source.index,
    kind: source.kind === "existing-area" ? "area" : "block",
    nodeId: source.nodeId,
  };
};

export const dropEdgeFor = ({
  axis = "vertical",
  pointerX,
  pointerY,
  rect,
  rtl = false,
}: {
  axis?: EditorDropAxis;
  pointerX?: number;
  pointerY: number;
  rect: { height: number; left: number; top: number; width: number };
  rtl?: boolean;
}): EditorDropEdge => {
  if (axis === "vertical" || pointerX === undefined) {
    return pointerY < rect.top + rect.height / 2 ? "before" : "after";
  }

  const beforeInline = pointerX < rect.left + rect.width / 2;

  return beforeInline !== rtl ? "before" : "after";
};

export const preferInnerCollisions = <
  TCollision extends { id: number | string },
>(
  collisions: readonly TCollision[],
  source?: EditorDragSource | null,
): TCollision[] => {
  const refs = collisions.map(
    collision =>
      [collision, nodeRefFromDraggableId(String(collision.id))] as const,
  );

  const nestable =
    source?.kind !== "existing-area" && source?.kind !== "catalog-area";

  if (nestable) {
    const inArea = refs.filter(
      ([, ref]) => ref !== null && ref.areaId !== null,
    );
    if (inArea.length > 0) return inArea.map(([collision]) => collision);

    const areas = collisions.filter(collision =>
      isAreaDroppableId(String(collision.id)),
    );
    if (areas.length > 0) return areas;
  }

  const atRoot = refs.filter(([, ref]) => ref !== null && ref.areaId === null);
  if (atRoot.length > 0) return atRoot.map(([collision]) => collision);

  const anyNode = refs.filter(([, ref]) => ref !== null);
  if (anyNode.length > 0) return anyNode.map(([collision]) => collision);

  return [...collisions];
};

const clamp = (value: number, max: number): number =>
  Math.min(Math.max(value, 0), max);

const sameContainer = (
  left: EditorContainerRef,
  right: EditorContainerRef,
): boolean => left.zoneId === right.zoneId && left.areaId === right.areaId;

const typeRejection = (
  capabilities: TargetCapabilities,
  type: string,
): EditorDropRejection | null => {
  if (!capabilities.registers(type)) return "not-registered";

  return capabilities.allows(type) ? null : "not-allowed";
};

const firstRejection = (
  capabilities: TargetCapabilities,
  types: readonly string[],
): EditorDropRejection | null => {
  for (const type of types) {
    const rejection = typeRejection(capabilities, type);
    if (rejection !== null) return rejection;
  }

  return null;
};

export const dropRejection = ({
  capabilities,
  source,
  target,
}: {
  capabilities: TargetCapabilities;
  source: EditorDragSource;
  target: EditorDropTarget | null;
}): EditorDropRejection | null => {
  if (!target) return null;

  if (source.kind === "catalog-area") {
    return target.container.areaId === null ? null : "nested-area";
  }

  if (source.kind === "existing-area") {
    if (target.container.areaId !== null) return "nested-area";

    return target.container.zoneId === source.container.zoneId
      ? null
      : firstRejection(capabilities, source.childTypes);
  }

  return typeRejection(capabilities, source.type);
};

const fillsTargetArea = (
  source: EditorDragSource,
  target: EditorDropTarget,
  targetNodeCount: number,
): boolean =>
  target.container.areaId !== null &&
  !areaHasRoom(targetNodeCount) &&
  (isCatalogSource(source) ||
    !sameContainer(target.container, source.container));

const movedBlocks = (source: EditorDragSource): number => {
  if (source.kind === "catalog-area") return 0;

  return source.kind === "existing-area" ? source.childTypes.length : 1;
};

const growsTargetRoot = (
  source: EditorDragSource,
  target: EditorDropTarget,
): boolean => {
  if (target.container.areaId !== null) return false;
  if (isCatalogSource(source)) return true;

  return (
    source.container.zoneId !== target.container.zoneId ||
    source.container.areaId !== null
  );
};

const capacityRejection = ({
  capacity,
  source,
  target,
  targetNodeCount,
}: {
  capacity: DropCapacity;
  source: EditorDragSource;
  target: EditorDropTarget;
  targetNodeCount: number;
}): EditorDropRejection | null => {
  if (fillsTargetArea(source, target, targetNodeCount)) return "area-full";

  const { source: leaving, target: landing } = capacity;

  if (
    growsTargetRoot(source, target) &&
    landing !== null &&
    !fitsRootNodeCap(landing.roots + 1)
  ) {
    return "zone-full";
  }

  if (
    !isCatalogSource(source) &&
    source.container.zoneId === target.container.zoneId
  ) {
    return null;
  }

  const moved = movedBlocks(source);
  if (moved === 0) return null;

  if (landing !== null && !fitsZoneMax(landing.max, landing.blocks + moved)) {
    return "zone-full";
  }

  return leaving !== null && !fitsZoneMin(leaving.min, leaving.blocks - moved)
    ? "zone-min"
    : null;
};

export const resolveDrop = ({
  capabilities,
  source,
  target,
  targetNodeCount,
}: ResolveDropArgs): null | ResolvedDrop => {
  if (!target) return null;
  if (dropRejection({ capabilities, source, target }) !== null) return null;
  if (fillsTargetArea(source, target, targetNodeCount)) return null;

  if (isCatalogSource(source)) {
    const toIndex =
      target.index === null
        ? targetNodeCount
        : clamp(
            target.index + (target.edge === "after" ? 1 : 0),
            targetNodeCount,
          );

    return source.kind === "catalog-area"
      ? { kind: "insert-area", to: target.container, toIndex }
      : {
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
  axis = "vertical",
  container,
  nodeIds,
  overNodeId,
  resolved,
}: {
  axis?: EditorDropAxis;
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
    axis,
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

export const decideDrop = (args: DecideDropArgs): DropDecision => {
  const { capabilities, capacity, source, target, targetNodeCount } = args;
  if (!target) return { rejection: null, resolved: null };

  const rejection =
    dropRejection({ capabilities, source, target }) ??
    capacityRejection({ capacity, source, target, targetNodeCount });

  return {
    rejection,
    resolved: rejection === null ? resolveDrop(args) : null,
  };
};
