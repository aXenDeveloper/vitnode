import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockUnknownData,
} from "../../blocks/types";
import type {
  EditorBlockRef,
  EditorZoneInvalidEntry,
  EditorZoneMount,
  EditorZoneState,
  VisualEditorAction,
  VisualEditorState,
} from "./types";

import { createBlockInstanceId } from "../../blocks/instance";

export const initialVisualEditorState: VisualEditorState = {
  droppedZoneIds: [],
  order: [],
  selected: null,
  zones: {},
};

const sameValue = (left: unknown, right: unknown): boolean => {
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

export const sameBlocks = (
  left: readonly AnyBlockInstance[],
  right: readonly AnyBlockInstance[],
): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every(
      (instance, at) =>
        instance.id === right[at].id &&
        instance.type === right[at].type &&
        sameValue(instance.data, right[at].data),
    ));

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

export const sameBlockRef = (
  left: EditorBlockRef | null,
  right: EditorBlockRef | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.blockId === right.blockId &&
    left.zoneId === right.zoneId);

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

export const findBlockInZone = (
  zone: EditorZoneState | undefined,
  blockId: string,
): null | { index: number; instance: AnyBlockInstance } => {
  if (!zone) return null;

  const index = zone.blocks.findIndex(instance => instance.id === blockId);

  return index === -1 ? null : { index, instance: zone.blocks[index] };
};

export const findBlock = (
  state: VisualEditorState,
  ref: EditorBlockRef,
): null | { index: number; instance: AnyBlockInstance } =>
  findBlockInZone(state.zones[ref.zoneId], ref.blockId);

const zoneChanged = (zone: EditorZoneState): boolean =>
  !sameBlocks(zone.blocks, zone.initial) ||
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

export const unsafeZoneIds = (state: VisualEditorState): string[] =>
  state.order.filter(zoneId => {
    const zone = state.zones[zoneId];

    return zone !== undefined && zone.invalid.length > 0;
  });

const clampIndex = (index: number, length: number): number => {
  if (!Number.isFinite(index)) return length;

  return Math.min(Math.max(Math.trunc(index), 0), length);
};

const insertAt = (
  blocks: readonly AnyBlockInstance[],
  index: number,
  instance: AnyBlockInstance,
): AnyBlockInstance[] => {
  const at = clampIndex(index, blocks.length);

  return [...blocks.slice(0, at), instance, ...blocks.slice(at)];
};

const withZones = (
  state: VisualEditorState,
  zones: Record<string, EditorZoneState>,
): VisualEditorState => ({ ...state, zones: { ...state.zones, ...zones } });

const withoutSelectionIn = (
  state: VisualEditorState,
  zoneId: string,
): VisualEditorState =>
  state.selected?.zoneId === zoneId ? { ...state, selected: null } : state;

const withResolvableSelection = (
  state: VisualEditorState,
  zoneId: string,
  blocks: readonly AnyBlockInstance[],
): VisualEditorState => {
  const selected = state.selected;

  return selected !== null &&
    selected.zoneId === zoneId &&
    !blocks.some(instance => instance.id === selected.blockId)
    ? { ...state, selected: null }
    : state;
};

const syncMountedZone = (
  state: VisualEditorState,
  zone: EditorZoneState,
  next: EditorZoneMount,
): VisualEditorState => {
  const metadataChanged =
    !sameAllowed(zone.allowedBlocks, next.allowedBlocks) ||
    zone.registry !== next.registry;
  const incomingChanged =
    !sameBlocks(zone.initial, next.blocks) ||
    !sameInvalidEntries(zone.initialInvalid, next.invalid);

  if (!metadataChanged && !incomingChanged) return state;

  const synced: EditorZoneState = metadataChanged
    ? { ...zone, allowedBlocks: next.allowedBlocks, registry: next.registry }
    : zone;

  if (!incomingChanged || zoneChanged(zone)) {
    return synced === zone ? state : withZones(state, { [next.id]: synced });
  }

  const blocks = [...next.blocks];
  const invalid = [...next.invalid];

  return withZones(withResolvableSelection(state, next.id, blocks), {
    [next.id]: {
      ...synced,
      blocks,
      initial: blocks,
      initialInvalid: invalid,
      invalid,
    },
  });
};

const mountZone = (
  state: VisualEditorState,
  next: EditorZoneMount,
): VisualEditorState => {
  const zone = state.zones[next.id];

  if (zone) return syncMountedZone(state, zone, next);

  const blocks = [...next.blocks];
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
        blocks,
        id: next.id,
        initial: blocks,
        initialInvalid: invalid,
        invalid,
        registry: next.registry,
      },
    },
  );
};

const unmountZone = (
  state: VisualEditorState,
  zoneId: string,
): VisualEditorState => {
  const zone = state.zones[zoneId];
  if (!zone) return state;

  const { [zoneId]: removed, ...zones } = state.zones;
  const dropped =
    zoneChanged(removed) && !state.droppedZoneIds.includes(zoneId);

  return {
    ...withoutSelectionIn(state, zoneId),
    droppedZoneIds: dropped
      ? [...state.droppedZoneIds, zoneId]
      : state.droppedZoneIds,
    order: state.order.filter(id => id !== zoneId),
    zones,
  };
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
        zones: Object.fromEntries(
          Object.entries(state.zones).map(([id, zone]) => [
            id,
            zone.blocks === zone.initial && zone.invalid === zone.initialInvalid
              ? zone
              : {
                  ...zone,
                  blocks: zone.initial,
                  invalid: zone.initialInvalid,
                },
          ]),
        ),
      };

    case "dismiss-dropped":
      return state.droppedZoneIds.length === 0
        ? state
        : { ...state, droppedZoneIds: [] };

    case "duplicate": {
      const zone = state.zones[action.ref.zoneId];
      const found = findBlockInZone(zone, action.ref.blockId);
      if (!zone || !found) return state;

      const copy: AnyBlockInstance = {
        data: cloneValue(found.instance.data) as BlockUnknownData,
        id: createBlockInstanceId(),
        type: found.instance.type,
      };

      return withZones(
        { ...state, selected: { blockId: copy.id, zoneId: zone.id } },
        {
          [zone.id]: {
            ...zone,
            blocks: insertAt(zone.blocks, found.index + 1, copy),
          },
        },
      );
    }

    case "insert": {
      const zone = state.zones[action.zoneId];
      if (!zone) return state;

      return withZones(state, {
        [action.zoneId]: {
          ...zone,
          blocks: insertAt(zone.blocks, action.index, action.instance),
        },
      });
    }

    case "mount":
      return mountZone(state, action.zone);

    case "move": {
      const source = state.zones[action.fromZoneId];
      const target = state.zones[action.toZoneId];
      const found = findBlockInZone(source, action.blockId);
      if (!source || !target || !found) return state;

      const remaining = source.blocks.filter((_, at) => at !== found.index);
      const selected = sameBlockRef(state.selected, {
        blockId: action.blockId,
        zoneId: action.fromZoneId,
      });

      if (action.fromZoneId === action.toZoneId) {
        return withZones(state, {
          [action.fromZoneId]: {
            ...source,
            blocks: insertAt(remaining, action.toIndex, found.instance),
          },
        });
      }

      const collides = findBlockInZone(target, action.blockId) !== null;
      const moved = collides
        ? { ...found.instance, id: createBlockInstanceId() }
        : found.instance;

      return withZones(
        selected
          ? {
              ...state,
              selected: { blockId: moved.id, zoneId: action.toZoneId },
            }
          : state,
        {
          [action.toZoneId]: {
            ...target,
            blocks: insertAt(target.blocks, action.toIndex, moved),
          },
          [action.fromZoneId]: { ...source, blocks: remaining },
        },
      );
    }

    case "remove": {
      const zone = state.zones[action.ref.zoneId];
      const found = findBlockInZone(zone, action.ref.blockId);
      if (!zone || !found) return state;

      return withZones(
        sameBlockRef(state.selected, action.ref)
          ? { ...state, selected: null }
          : state,
        {
          [zone.id]: {
            ...zone,
            blocks: zone.blocks.filter((_, at) => at !== found.index),
          },
        },
      );
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
        zones: Object.fromEntries(
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
            const blocks = sameBlocks(zone.blocks, sent) ? stored : zone.blocks;

            return [
              id,
              blocks === zone.blocks &&
              stored === zone.initial &&
              storedInvalid === zone.initialInvalid
                ? zone
                : {
                    ...zone,
                    blocks,
                    initial: stored,
                    initialInvalid: storedInvalid,
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

      if (findBlock(state, action.ref) === null) return state;

      return sameBlockRef(state.selected, action.ref)
        ? state
        : { ...state, selected: action.ref };
    }

    case "unmount":
      return unmountZone(state, action.zoneId);

    case "update": {
      const zone = state.zones[action.ref.zoneId];
      const found = findBlockInZone(zone, action.ref.blockId);
      if (!zone || !found || sameValue(found.instance.data, action.data)) {
        return state;
      }

      return withZones(state, {
        [zone.id]: {
          ...zone,
          blocks: zone.blocks.map((instance, at) =>
            at === found.index ? { ...instance, data: action.data } : instance,
          ),
        },
      });
    }
  }
};
