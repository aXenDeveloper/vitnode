import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockUnknownData,
} from "../../blocks/types";
import type {
  EditorZoneInvalidEntry,
  EditorZoneMount,
  EditorZoneState,
  VisualEditorAction,
  VisualEditorState,
} from "./types";

import { createBlockInstanceId } from "../../blocks/instance";

export const initialVisualEditorState: VisualEditorState = {
  order: [],
  selectedBlockId: null,
  selectedZoneId: null,
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
    left.every((entry, at) => entry === right[at]));

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

export const findBlock = (
  state: VisualEditorState,
  blockId: string,
): null | { index: number; instance: AnyBlockInstance; zoneId: string } => {
  for (const zoneId of state.order) {
    const zone = state.zones[zoneId];
    if (!zone) continue;

    const index = zone.blocks.findIndex(instance => instance.id === blockId);
    if (index !== -1) {
      return { index, instance: zone.blocks[index], zoneId };
    }
  }

  return null;
};

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

const mountZone = (
  state: VisualEditorState,
  next: EditorZoneMount,
): VisualEditorState => {
  const zone = state.zones[next.id];

  if (zone) {
    if (
      sameAllowed(zone.allowedBlocks, next.allowedBlocks) &&
      zone.registry === next.registry
    ) {
      return state;
    }

    return withZones(state, {
      [next.id]: {
        ...zone,
        allowedBlocks: next.allowedBlocks,
        registry: next.registry,
      },
    });
  }

  const blocks = [...next.blocks];
  const invalid = [...next.invalid];

  return withZones(
    { ...state, order: [...state.order, next.id] },
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

export const visualEditorReducer = (
  state: VisualEditorState,
  action: VisualEditorAction,
): VisualEditorState => {
  switch (action.type) {
    case "discard":
      return {
        ...state,
        selectedBlockId: null,
        selectedZoneId: null,
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

    case "duplicate": {
      const found = findBlock(state, action.blockId);
      if (!found) return state;

      const zone = state.zones[found.zoneId];
      const copy: AnyBlockInstance = {
        data: cloneValue(found.instance.data) as BlockUnknownData,
        id: createBlockInstanceId(),
        type: found.instance.type,
      };

      return withZones(
        {
          ...state,
          selectedBlockId: copy.id,
          selectedZoneId: found.zoneId,
        },
        {
          [found.zoneId]: {
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
      const found = findBlock(state, action.blockId);
      const target = state.zones[action.toZoneId];
      if (!found || !target) return state;

      const source = state.zones[found.zoneId];
      const remaining = source.blocks.filter(
        instance => instance.id !== action.blockId,
      );
      const selected = state.selectedBlockId === action.blockId;
      const next = selected
        ? { ...state, selectedZoneId: action.toZoneId }
        : state;

      if (found.zoneId === action.toZoneId) {
        return withZones(next, {
          [found.zoneId]: {
            ...source,
            blocks: insertAt(remaining, action.toIndex, found.instance),
          },
        });
      }

      return withZones(next, {
        [action.toZoneId]: {
          ...target,
          blocks: insertAt(target.blocks, action.toIndex, found.instance),
        },
        [found.zoneId]: { ...source, blocks: remaining },
      });
    }

    case "remove": {
      const found = findBlock(state, action.blockId);
      if (!found) return state;

      const zone = state.zones[found.zoneId];
      const selected = state.selectedBlockId === action.blockId;

      return withZones(
        selected
          ? { ...state, selectedBlockId: null, selectedZoneId: null }
          : state,
        {
          [found.zoneId]: {
            ...zone,
            blocks: zone.blocks.filter(
              instance => instance.id !== action.blockId,
            ),
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

    case "saved":
      return {
        ...state,
        zones: Object.fromEntries(
          Object.entries(state.zones).map(([id, zone]) => {
            const persisted = Object.hasOwn(action.snapshot, id)
              ? action.snapshot[id]
              : zone.initial;
            const persistedInvalid = Object.hasOwn(action.invalid, id)
              ? action.invalid[id]
              : zone.initialInvalid;

            return [
              id,
              persisted === zone.initial &&
              persistedInvalid === zone.initialInvalid
                ? zone
                : {
                    ...zone,
                    initial: persisted,
                    initialInvalid: persistedInvalid,
                  },
            ];
          }),
        ),
      };

    case "select": {
      if (action.blockId === null) {
        return state.selectedBlockId === null && state.selectedZoneId === null
          ? state
          : { ...state, selectedBlockId: null, selectedZoneId: null };
      }

      const found = findBlock(state, action.blockId);
      if (!found) return state;

      return state.selectedBlockId === action.blockId &&
        state.selectedZoneId === found.zoneId
        ? state
        : {
            ...state,
            selectedBlockId: action.blockId,
            selectedZoneId: found.zoneId,
          };
    }

    case "update": {
      const found = findBlock(state, action.blockId);
      if (!found || sameValue(found.instance.data, action.data)) return state;

      const zone = state.zones[found.zoneId];

      return withZones(state, {
        [found.zoneId]: {
          ...zone,
          blocks: zone.blocks.map(instance =>
            instance.id === action.blockId
              ? { ...instance, data: action.data }
              : instance,
          ),
        },
      });
    }
  }
};
