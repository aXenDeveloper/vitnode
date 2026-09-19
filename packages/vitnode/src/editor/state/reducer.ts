import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockAreaInstance,
  BlockUnknownData,
  ContentNode,
} from "../../blocks/types";
import type {
  EditorContainerRef,
  EditorNodeFound,
  EditorNodeRef,
  EditorZoneInvalidEntry,
  EditorZoneMount,
  EditorZoneState,
  VisualEditorAction,
  VisualEditorState,
} from "./types";

import { contentNodeBlocks, isBlockAreaInstance } from "../../blocks/area";
import { AREA_CHILDREN_DEFAULT_MAX } from "../../blocks/const";
import { createBlockInstanceId } from "../../blocks/instance";
import {
  areaHasRoom,
  fitsRootNodeCap,
  fitsZoneMax,
  fitsZoneMin,
  zoneBlockCount,
  zoneRootNodeCount,
} from "./bounds";
import { refusesAnyType, targetCapabilities } from "./capabilities";
import { isRepairRemoval } from "./repair";

const emptyZones = (): Record<string, EditorZoneState> => Object.create(null);

const zonesFrom = (
  entries: Iterable<readonly [string, EditorZoneState]>,
): Record<string, EditorZoneState> => {
  const zones = emptyZones();

  for (const [id, zone] of entries) zones[id] = zone;

  return zones;
};

export const initialVisualEditorState: VisualEditorState = {
  droppedZoneIds: [],
  order: [],
  selected: null,
  zones: emptyZones(),
};

export const sameValue = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, at) => sameValue(item, right[at]))
    );
  }

  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null
  ) {
    return false;
  }

  const leftEntries = Object.entries(left as Record<string, unknown>);
  const rightRecord = right as Record<string, unknown>;

  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, item]) => key in rightRecord && sameValue(item, rightRecord[key]),
    )
  );
};

const isBlockNode = (node: ContentNode): node is AnyBlockInstance =>
  !isBlockAreaInstance(node);

export const nodeKindOf = (node: ContentNode): "area" | "block" =>
  isBlockAreaInstance(node) ? "area" : "block";

const sameBlock = (left: AnyBlockInstance, right: AnyBlockInstance): boolean =>
  left === right ||
  (left.id === right.id &&
    left.type === right.type &&
    left.variant === right.variant &&
    sameValue(left.data, right.data));

const sameBlockList = (
  left: readonly AnyBlockInstance[],
  right: readonly AnyBlockInstance[],
): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every((instance, at) => sameBlock(instance, right[at])));

export const sameNode = (left: ContentNode, right: ContentNode): boolean => {
  if (left === right) return true;
  if (left.id !== right.id) return false;

  if (isBlockAreaInstance(left)) {
    return (
      isBlockAreaInstance(right) &&
      sameValue(left.layout, right.layout) &&
      sameBlockList(left.children, right.children)
    );
  }

  return !isBlockAreaInstance(right) && sameBlock(left, right);
};

export const sameNodes = (
  left: readonly ContentNode[],
  right: readonly ContentNode[],
): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every((node, at) => sameNode(node, right[at])));

export const sameInvalidEntries = (
  left: readonly EditorZoneInvalidEntry[],
  right: readonly EditorZoneInvalidEntry[],
): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every(
      (entry, at) =>
        entry === right[at] ||
        (entry.index === right[at].index &&
          sameValue(entry.value, right[at].value)),
    ));

export const sameContainerRef = (
  left: EditorContainerRef,
  right: EditorContainerRef,
): boolean => left.zoneId === right.zoneId && left.areaId === right.areaId;

export const sameNodeRef = (
  left: EditorNodeRef | null,
  right: EditorNodeRef | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.nodeId === right.nodeId &&
    left.kind === right.kind &&
    sameContainerRef(left, right));

export const containerOf = (ref: EditorNodeRef): EditorContainerRef => ({
  areaId: ref.areaId,
  zoneId: ref.zoneId,
});

const sameAllowed = (
  left: BlockAllowedSpec | undefined,
  right: BlockAllowedSpec | undefined,
): boolean => {
  if (left === right) return true;
  if (typeof left === "string" || typeof right === "string") return false;
  if (left === undefined || right === undefined) return false;

  return (
    left.length === right.length &&
    left.every((entry, at) => entry === right[at])
  );
};

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      cloneValue(item),
    ]),
  );
};

const areaAt = (
  nodes: readonly ContentNode[],
  areaId: string,
): null | { area: BlockAreaInstance; index: number } => {
  const index = nodes.findIndex(
    node => node.id === areaId && isBlockAreaInstance(node),
  );
  if (index === -1) return null;

  const node = nodes[index];

  return isBlockAreaInstance(node) ? { area: node, index } : null;
};

const nodesIn = (
  nodes: readonly ContentNode[],
  areaId: null | string,
): null | readonly ContentNode[] =>
  areaId === null ? nodes : (areaAt(nodes, areaId)?.area.children ?? null);

export const containerNodes = (
  state: VisualEditorState,
  container: EditorContainerRef,
): null | readonly ContentNode[] => {
  const zone = state.zones[container.zoneId];

  return zone ? nodesIn(zone.nodes, container.areaId) : null;
};

const foundIn = (
  nodes: readonly ContentNode[],
  ref: EditorNodeRef,
): EditorNodeFound | null => {
  const container = nodesIn(nodes, ref.areaId);
  if (!container) return null;

  const index = container.findIndex(node => node.id === ref.nodeId);
  if (index === -1) return null;

  const node = container[index];

  return nodeKindOf(node) === ref.kind
    ? { container: containerOf(ref), index, node }
    : null;
};

export const findNode = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): EditorNodeFound | null => {
  const zone = state.zones[ref.zoneId];

  return zone ? foundIn(zone.nodes, ref) : null;
};

export const findBlock = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): null | { index: number; instance: AnyBlockInstance } => {
  const found = findNode(state, ref);

  return found && isBlockNode(found.node)
    ? { index: found.index, instance: found.node }
    : null;
};

export const findArea = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): null | { area: BlockAreaInstance; index: number } => {
  const found = findNode(state, ref);

  return found && isBlockAreaInstance(found.node)
    ? { area: found.node, index: found.index }
    : null;
};

const zoneChanged = (zone: EditorZoneState): boolean =>
  !sameNodes(zone.nodes, zone.initial) ||
  !sameInvalidEntries(zone.invalid, zone.initialInvalid);

export const changedZoneIds = (state: VisualEditorState): string[] =>
  state.order.filter(zoneId => {
    const zone = state.zones[zoneId];

    return zone !== undefined && zoneChanged(zone);
  });

export const isVisualEditorDirty = (state: VisualEditorState): boolean =>
  state.order.some(zoneId => {
    const zone = state.zones[zoneId];

    return zone !== undefined && zoneChanged(zone);
  });

const holdsRejectedBlock = (zone: EditorZoneState): boolean =>
  contentNodeBlocks(zone.nodes).some(block => isRepairRemoval(zone, block));

const breaksZoneBounds = (zone: EditorZoneState): boolean => {
  const blocks = zoneBlockCount(zone.nodes);

  return (
    !fitsZoneMin(zone.min, blocks) ||
    !fitsZoneMax(zone.max, blocks) ||
    !fitsRootNodeCap(zoneRootNodeCount(zone.nodes))
  );
};

export const unsafeZoneIds = (state: VisualEditorState): string[] =>
  state.order.filter(zoneId => {
    const zone = state.zones[zoneId];

    return (
      zone !== undefined &&
      (zone.invalid.length > 0 ||
        breaksZoneBounds(zone) ||
        holdsRejectedBlock(zone))
    );
  });

const clampIndex = (index: number, length: number): number => {
  if (!Number.isFinite(index)) return length;

  return Math.min(Math.max(Math.trunc(index), 0), length);
};

const insertAt = (
  nodes: readonly ContentNode[],
  index: number,
  node: ContentNode,
): ContentNode[] => {
  const at = clampIndex(index, nodes.length);

  return [...nodes.slice(0, at), node, ...nodes.slice(at)];
};

const withZones = (
  state: VisualEditorState,
  zones: Record<string, EditorZoneState>,
): VisualEditorState => ({
  ...state,
  zones: Object.assign(emptyZones(), state.zones, zones),
});

const zoneKeepsRootNodeCap = (
  zone: EditorZoneState,
  nodes: readonly ContentNode[],
): boolean => {
  const after = zoneRootNodeCount(nodes);

  return after <= zoneRootNodeCount(zone.nodes) || fitsRootNodeCap(after);
};

const zoneKeepsBounds = (
  zone: EditorZoneState,
  nodes: readonly ContentNode[],
): boolean => {
  if (!zoneKeepsRootNodeCap(zone, nodes)) return false;

  const before = zoneBlockCount(zone.nodes);
  const after = zoneBlockCount(nodes);

  if (after > before) return fitsZoneMax(zone.max, after);
  if (after < before) return fitsZoneMin(zone.min, after);

  return true;
};

const growsPastAreaCap = (
  before: readonly ContentNode[],
  after: readonly ContentNode[],
): boolean =>
  after.length > before.length && after.length > AREA_CHILDREN_DEFAULT_MAX;

const updateContainer = (
  zone: EditorZoneState,
  container: EditorContainerRef,
  update: (nodes: readonly ContentNode[]) => readonly ContentNode[],
): EditorZoneState | null => {
  if (container.areaId === null) {
    return { ...zone, nodes: update(zone.nodes) };
  }

  const found = areaAt(zone.nodes, container.areaId);
  if (!found) return null;

  const next = update(found.area.children);
  const children = next.filter(isBlockNode);
  if (children.length !== next.length) return null;
  if (growsPastAreaCap(found.area.children, children)) return null;

  return {
    ...zone,
    nodes: zone.nodes.map((node, at) =>
      at === found.index ? { ...found.area, children } : node,
    ),
  };
};

const boundedUpdate = (
  zone: EditorZoneState,
  container: EditorContainerRef,
  update: (nodes: readonly ContentNode[]) => readonly ContentNode[],
): EditorZoneState | null => {
  const next = updateContainer(zone, container, update);

  return next !== null && zoneKeepsBounds(zone, next.nodes) ? next : null;
};

export const containerAcceptsBlock = (
  state: VisualEditorState,
  container: EditorContainerRef,
): boolean => {
  const zone = state.zones[container.zoneId];
  const nodes = containerNodes(state, container);
  if (!zone || nodes === null) return false;

  if (container.areaId === null) {
    if (!fitsRootNodeCap(zoneRootNodeCount(zone.nodes) + 1)) return false;
  } else if (!areaHasRoom(nodes.length)) {
    return false;
  }

  return fitsZoneMax(zone.max, zoneBlockCount(zone.nodes) + 1);
};

const zoneNodeIds = (zone: EditorZoneState): Set<string> => {
  const ids = new Set<string>();

  for (const node of zone.nodes) {
    ids.add(node.id);
    if (isBlockAreaInstance(node)) {
      for (const child of node.children) ids.add(child.id);
    }
  }

  return ids;
};

const duplicateBlock = (instance: AnyBlockInstance): AnyBlockInstance => ({
  ...instance,
  data: cloneValue(instance.data) as BlockUnknownData,
  id: createBlockInstanceId(),
});

const duplicateNode = (node: ContentNode): ContentNode =>
  isBlockAreaInstance(node)
    ? {
        children: node.children.map(duplicateBlock),
        id: createBlockInstanceId(),
        kind: node.kind,
        layout: { ...node.layout },
      }
    : duplicateBlock(node);

interface RelocatedNode {
  idMap: ReadonlyMap<string, string>;
  node: ContentNode;
}

const relocate = (
  node: ContentNode,
  taken: ReadonlySet<string>,
): RelocatedNode => {
  const idMap = new Map<string, string>();

  const keep = (id: string): string => {
    if (!taken.has(id)) return id;

    const fresh = createBlockInstanceId();
    idMap.set(id, fresh);

    return fresh;
  };

  if (!isBlockAreaInstance(node)) {
    const id = keep(node.id);

    return { idMap, node: id === node.id ? node : { ...node, id } };
  }

  const id = keep(node.id);
  const children = node.children.map(child => {
    const childId = keep(child.id);

    return childId === child.id ? child : { ...child, id: childId };
  });

  return {
    idMap,
    node:
      idMap.size === 0
        ? node
        : {
            ...node,
            children,
            id,
          },
  };
};

const withoutSelectionIn = (
  state: VisualEditorState,
  zoneId: string,
): VisualEditorState =>
  state.selected?.zoneId === zoneId ? { ...state, selected: null } : state;

const selectionInside = (
  selected: EditorNodeRef | null,
  ref: EditorNodeRef,
): boolean =>
  selected !== null &&
  ref.kind === "area" &&
  selected.zoneId === ref.zoneId &&
  selected.areaId === ref.nodeId;

const withoutSelectionOn = (
  state: VisualEditorState,
  ref: EditorNodeRef,
): VisualEditorState =>
  sameNodeRef(state.selected, ref) || selectionInside(state.selected, ref)
    ? { ...state, selected: null }
    : state;

const withResolvableSelection = (
  state: VisualEditorState,
  zoneId: string,
  nodes: readonly ContentNode[],
): VisualEditorState => {
  const selected = state.selected;

  return selected !== null &&
    selected.zoneId === zoneId &&
    foundIn(nodes, selected) === null
    ? { ...state, selected: null }
    : state;
};

const wasSuperseded = (
  zone: EditorZoneState,
  nodes: readonly ContentNode[],
): boolean => zone.superseded.some(older => sameNodes(older, nodes));

const withoutPendingIncoming = (zone: EditorZoneState): EditorZoneState => {
  if (zone.pendingIncoming === undefined) return zone;

  const { pendingIncoming: _dropped, ...rest } = zone;

  return rest;
};

const holdsIncoming = (
  zone: EditorZoneState,
  next: EditorZoneMount,
): boolean => {
  const held = zone.pendingIncoming;

  return (
    held !== undefined &&
    sameNodes(held.nodes, next.nodes) &&
    sameInvalidEntries(held.invalid, next.invalid)
  );
};

const syncMountedZone = (
  state: VisualEditorState,
  zone: EditorZoneState,
  next: EditorZoneMount,
): VisualEditorState => {
  const metadataChanged =
    !sameAllowed(zone.allowedBlocks, next.allowedBlocks) ||
    zone.max !== next.max ||
    zone.min !== next.min ||
    zone.registry !== next.registry;
  const incomingChanged =
    !sameNodes(zone.initial, next.nodes) ||
    !sameInvalidEntries(zone.initialInvalid, next.invalid);

  const caughtUp = zone.superseded.length > 0 && !incomingChanged;

  const settled: EditorZoneState = caughtUp
    ? { ...zone, superseded: [] }
    : zone;
  const synced: EditorZoneState = metadataChanged
    ? {
        ...settled,
        allowedBlocks: next.allowedBlocks,
        max: next.max,
        min: next.min,
        registry: next.registry,
      }
    : settled;

  const kept = (updated: EditorZoneState): VisualEditorState =>
    updated === zone ? state : withZones(state, { [next.id]: updated });

  if (!incomingChanged) return kept(withoutPendingIncoming(synced));

  if (wasSuperseded(zone, next.nodes)) return kept(synced);

  if (zoneChanged(zone)) {
    return holdsIncoming(zone, next)
      ? kept(synced)
      : kept({
          ...synced,
          pendingIncoming: {
            invalid: [...next.invalid],
            nodes: [...next.nodes],
          },
        });
  }

  const nodes = [...next.nodes];
  const invalid = [...next.invalid];

  return withZones(withResolvableSelection(state, next.id, nodes), {
    [next.id]: {
      ...withoutPendingIncoming(synced),
      initial: nodes,
      initialInvalid: invalid,
      invalid,
      nodes,
    },
  });
};

const mountZone = (
  state: VisualEditorState,
  next: EditorZoneMount,
): VisualEditorState => {
  const zone = Object.hasOwn(state.zones, next.id)
    ? state.zones[next.id]
    : undefined;

  if (zone !== undefined) return syncMountedZone(state, zone, next);

  const nodes = [...next.nodes];
  const invalid = [...next.invalid];

  return withZones(
    {
      ...state,
      droppedZoneIds: state.droppedZoneIds.filter(id => id !== next.id),
      order: [...state.order, next.id],
    },
    {
      [next.id]: {
        allowedBlocks: next.allowedBlocks,
        id: next.id,
        initial: nodes,
        initialInvalid: invalid,
        invalid,
        max: next.max,
        min: next.min,
        nodes,
        registry: next.registry,
        superseded: [],
      },
    },
  );
};

const unmountZone = (
  state: VisualEditorState,
  zoneId: string,
): VisualEditorState => {
  const zone = Object.hasOwn(state.zones, zoneId)
    ? state.zones[zoneId]
    : undefined;
  if (zone === undefined) return state;

  const dropped = zoneChanged(zone) && !state.droppedZoneIds.includes(zoneId);

  return {
    ...withoutSelectionIn(state, zoneId),
    droppedZoneIds: dropped
      ? [...state.droppedZoneIds, zoneId]
      : state.droppedZoneIds,
    order: state.order.filter(id => id !== zoneId),
    zones: zonesFrom(
      Object.entries(state.zones).filter(([id]) => id !== zoneId),
    ),
  };
};

const discardedZone = (zone: EditorZoneState): EditorZoneState => {
  const pending = zone.pendingIncoming;

  if (pending !== undefined) {
    return {
      ...withoutPendingIncoming(zone),
      initial: pending.nodes,
      initialInvalid: pending.invalid,
      invalid: pending.invalid,
      nodes: pending.nodes,
      superseded: [],
    };
  }

  return zoneChanged(zone)
    ? {
        ...zone,
        invalid: zone.initialInvalid,
        nodes: zone.initial,
        superseded: [],
      }
    : zone;
};

const movedSelection = (
  state: VisualEditorState,
  moved: EditorNodeRef,
  to: EditorContainerRef,
  idMap: ReadonlyMap<string, string>,
): EditorNodeRef | null => {
  const selected = state.selected;
  if (selected === null) return null;

  if (sameNodeRef(selected, moved)) {
    return {
      areaId: to.areaId,
      kind: moved.kind,
      nodeId: idMap.get(moved.nodeId) ?? moved.nodeId,
      zoneId: to.zoneId,
    };
  }

  if (!selectionInside(selected, moved)) return selected;

  return {
    areaId: idMap.get(moved.nodeId) ?? moved.nodeId,
    kind: selected.kind,
    nodeId: idMap.get(selected.nodeId) ?? selected.nodeId,
    zoneId: to.zoneId,
  };
};

const moveNode = (
  state: VisualEditorState,
  action: Extract<VisualEditorAction, { type: "move" }>,
): VisualEditorState => {
  const source = state.zones[action.from.zoneId];
  const target = state.zones[action.to.zoneId];
  if (!source || !target) return state;

  const from = containerNodes(state, action.from);
  if (!from || containerNodes(state, action.to) === null) return state;

  const index = from.findIndex(node => node.id === action.nodeId);
  if (index === -1) return state;

  const node = from[index];
  const kind = nodeKindOf(node);
  if (kind === "area" && action.to.areaId !== null) return state;

  if (
    action.from.zoneId !== action.to.zoneId &&
    refusesAnyType(
      targetCapabilities(state, action.to),
      isBlockAreaInstance(node)
        ? node.children.map(child => child.type)
        : [node.type],
    )
  ) {
    return state;
  }

  if (sameContainerRef(action.from, action.to)) {
    const reordered = updateContainer(source, action.from, nodes =>
      insertAt(
        nodes.filter((_, at) => at !== index),
        action.toIndex,
        node,
      ),
    );

    return reordered ? withZones(state, { [source.id]: reordered }) : state;
  }

  const detached = updateContainer(source, action.from, nodes =>
    nodes.filter((_, at) => at !== index),
  );
  if (!detached) return state;

  const sameZone = action.from.zoneId === action.to.zoneId;
  const host = sameZone ? detached : target;
  const { idMap, node: moved } = relocate(node, zoneNodeIds(host));
  const attached = updateContainer(host, action.to, nodes =>
    insertAt(nodes, action.toIndex, moved),
  );
  if (!attached) return state;

  if (sameZone) {
    if (!zoneKeepsBounds(source, attached.nodes)) return state;
  } else if (
    !zoneKeepsBounds(source, detached.nodes) ||
    !zoneKeepsBounds(target, attached.nodes)
  ) {
    return state;
  }

  const selected = movedSelection(
    state,
    {
      areaId: action.from.areaId,
      kind,
      nodeId: action.nodeId,
      zoneId: action.from.zoneId,
    },
    action.to,
    idMap,
  );

  return withZones(
    selected === state.selected ? state : { ...state, selected },
    sameZone
      ? { [source.id]: attached }
      : { [source.id]: detached, [target.id]: attached },
  );
};

export const visualEditorReducer = (
  state: VisualEditorState,
  action: VisualEditorAction,
): VisualEditorState => {
  switch (action.type) {
    case "discard":
      return {
        ...state,
        droppedZoneIds: [],
        selected: null,
        zones: zonesFrom(
          Object.entries(state.zones).map(([id, zone]) => [
            id,
            discardedZone(zone),
          ]),
        ),
      };

    case "dismiss-dropped":
      return state.droppedZoneIds.length === 0
        ? state
        : { ...state, droppedZoneIds: [] };

    case "duplicate": {
      const zone = state.zones[action.ref.zoneId];
      const found = findNode(state, action.ref);
      if (!zone || !found) return state;

      const copy = duplicateNode(found.node);
      const next = boundedUpdate(zone, found.container, nodes =>
        insertAt(nodes, found.index + 1, copy),
      );
      if (!next) return state;

      return withZones(
        {
          ...state,
          selected: {
            areaId: found.container.areaId,
            kind: action.ref.kind,
            nodeId: copy.id,
            zoneId: zone.id,
          },
        },
        { [zone.id]: next },
      );
    }

    case "insert": {
      const zone = state.zones[action.container.zoneId];
      if (!zone) return state;

      const next = boundedUpdate(zone, action.container, nodes =>
        insertAt(nodes, action.index, action.instance),
      );

      return next ? withZones(state, { [zone.id]: next }) : state;
    }

    case "insert-area": {
      const zone = state.zones[action.zoneId];
      if (!zone || action.area.children.length > AREA_CHILDREN_DEFAULT_MAX) {
        return state;
      }

      const nodes = insertAt(zone.nodes, action.index, action.area);
      if (!zoneKeepsBounds(zone, nodes)) return state;

      return withZones(state, { [zone.id]: { ...zone, nodes } });
    }

    case "mount":
      return mountZone(state, action.zone);

    case "move":
      return moveNode(state, action);

    case "remove": {
      const zone = state.zones[action.ref.zoneId];
      const found = findNode(state, action.ref);
      if (!zone || !found) return state;

      const shrink = (nodes: readonly ContentNode[]): readonly ContentNode[] =>
        nodes.filter((_, at) => at !== found.index);
      const next = isRepairRemoval(zone, found.node)
        ? updateContainer(zone, found.container, shrink)
        : boundedUpdate(zone, found.container, shrink);
      if (!next) return state;

      return withZones(withoutSelectionOn(state, action.ref), {
        [zone.id]: next,
      });
    }

    case "remove-invalid": {
      const zone = state.zones[action.zoneId];
      if (!zone) return state;

      const invalid = zone.invalid.filter(
        entry => entry.index !== action.index,
      );
      if (invalid.length === zone.invalid.length) return state;

      return withZones(state, { [action.zoneId]: { ...zone, invalid } });
    }

    case "saved": {
      const canonical = action.canonical;

      return {
        ...state,
        droppedZoneIds: [],
        zones: zonesFrom(
          Object.entries(state.zones).map(([id, zone]) => {
            if (!Object.hasOwn(action.snapshot, id)) return [id, zone];

            const sent = action.snapshot[id];
            const stored =
              canonical !== undefined && Object.hasOwn(canonical, id)
                ? canonical[id]
                : sent;
            const storedInvalid = Object.hasOwn(action.invalid, id)
              ? action.invalid[id]
              : zone.initialInvalid;
            const nodes = sameNodes(zone.nodes, sent) ? stored : zone.nodes;
            const superseded = sameNodes(zone.initial, stored)
              ? zone.superseded
              : [...zone.superseded, zone.initial];
            const written = withoutPendingIncoming(zone);

            return [
              id,
              written === zone &&
              nodes === zone.nodes &&
              stored === zone.initial &&
              storedInvalid === zone.initialInvalid &&
              superseded === zone.superseded
                ? zone
                : {
                    ...written,
                    initial: stored,
                    initialInvalid: storedInvalid,
                    nodes,
                    superseded,
                  },
            ];
          }),
        ),
      };
    }

    case "select": {
      if (action.ref === null) {
        return state.selected === null ? state : { ...state, selected: null };
      }

      if (findNode(state, action.ref) === null) return state;

      return sameNodeRef(state.selected, action.ref)
        ? state
        : { ...state, selected: action.ref };
    }

    case "set-variant": {
      const zone = state.zones[action.ref.zoneId];
      const found = findBlock(state, action.ref);
      if (!zone || !found || found.instance.variant === action.variant) {
        return state;
      }

      const { variant: _dropped, ...withoutVariant } = found.instance;
      const updated: AnyBlockInstance =
        action.variant === undefined
          ? withoutVariant
          : { ...found.instance, variant: action.variant };

      const next = updateContainer(zone, containerOf(action.ref), nodes =>
        nodes.map((node, at) => (at === found.index ? updated : node)),
      );

      return next ? withZones(state, { [zone.id]: next }) : state;
    }

    case "unmount":
      return unmountZone(state, action.zoneId);

    case "unwrap-area": {
      const zone = state.zones[action.ref.zoneId];
      const found = findArea(state, action.ref);
      if (!zone || !found) return state;

      const nodes = [
        ...zone.nodes.slice(0, found.index),
        ...found.area.children,
        ...zone.nodes.slice(found.index + 1),
      ];
      if (!zoneKeepsBounds(zone, nodes)) return state;

      const selected = state.selected;
      const unwrapped =
        selected !== null && selectionInside(selected, action.ref)
          ? {
              ...state,
              selected: {
                areaId: null,
                kind: selected.kind,
                nodeId: selected.nodeId,
                zoneId: selected.zoneId,
              },
            }
          : withoutSelectionOn(state, action.ref);

      return withZones(unwrapped, { [zone.id]: { ...zone, nodes } });
    }

    case "update": {
      const zone = state.zones[action.ref.zoneId];
      const found = findBlock(state, action.ref);
      if (!zone || !found) return state;

      const data: BlockUnknownData = { ...found.instance.data, ...action.data };
      for (const name of action.remove ?? []) delete data[name];
      if (sameValue(found.instance.data, data)) return state;

      const next = updateContainer(zone, containerOf(action.ref), nodes =>
        nodes.map((node, at) =>
          at === found.index ? { ...found.instance, data } : node,
        ),
      );

      return next ? withZones(state, { [zone.id]: next }) : state;
    }

    case "update-area-layout": {
      const zone = state.zones[action.ref.zoneId];
      const found = findArea(state, action.ref);
      if (!zone || !found || sameValue(found.area.layout, action.layout)) {
        return state;
      }

      return withZones(state, {
        [zone.id]: {
          ...zone,
          nodes: zone.nodes.map((node, at) =>
            at === found.index
              ? { ...found.area, layout: action.layout }
              : node,
          ),
        },
      });
    }
  }
};
