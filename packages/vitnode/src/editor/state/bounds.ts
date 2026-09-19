import type { ContentNode } from "../../blocks/types";
import type { EditorZoneState, VisualEditorState } from "./types";

import { contentNodeBlocks } from "../../blocks/area";
import {
  AREA_CHILDREN_DEFAULT_MAX,
  CONTENT_BLOCKS_ABSOLUTE_MAX,
} from "../../blocks/const";

export interface ZoneCapacity {
  blocks: number;
  max: number | undefined;
  min: number | undefined;
  roots: number;
}

export interface DropCapacity {
  source: null | ZoneCapacity;
  target: null | ZoneCapacity;
}

export const zoneBlockCount = (nodes: readonly ContentNode[]): number =>
  contentNodeBlocks(nodes).length;

export const zoneRootNodeCount = (nodes: readonly ContentNode[]): number =>
  nodes.length;

export const fitsRootNodeCap = (roots: number): boolean =>
  roots <= CONTENT_BLOCKS_ABSOLUTE_MAX;

export const fitsZoneMax = (max: number | undefined, blocks: number): boolean =>
  max === undefined || blocks <= max;

export const fitsZoneMin = (min: number | undefined, blocks: number): boolean =>
  min === undefined || blocks >= min;

export const areaHasRoom = (children: number): boolean =>
  children < AREA_CHILDREN_DEFAULT_MAX;

export const zoneCapacity = (
  zone: EditorZoneState | undefined,
): null | ZoneCapacity =>
  zone === undefined
    ? null
    : {
        blocks: zoneBlockCount(zone.nodes),
        max: zone.max,
        min: zone.min,
        roots: zoneRootNodeCount(zone.nodes),
      };

export const dropCapacity = (
  state: VisualEditorState,
  { from, to }: { from: null | string; to: string },
): DropCapacity => ({
  source: from === null ? null : zoneCapacity(state.zones[from]),
  target: zoneCapacity(state.zones[to]),
});

export const refusesRemoval = (
  capacity: null | ZoneCapacity,
  blocks: number,
  repairs = false,
): boolean =>
  !repairs &&
  capacity !== null &&
  blocks > 0 &&
  !fitsZoneMin(capacity.min, capacity.blocks - blocks);

export const refusesDuplicate = (
  capacity: null | ZoneCapacity,
  blocks: number,
  siblings: null | number,
): boolean =>
  capacity !== null &&
  (!fitsZoneMax(capacity.max, capacity.blocks + blocks) ||
    (siblings === null
      ? !fitsRootNodeCap(capacity.roots + 1)
      : !areaHasRoom(siblings)));

export const refusesUnwrap = (
  capacity: null | ZoneCapacity,
  children: number,
): boolean => {
  if (capacity === null) return false;

  const roots = capacity.roots - 1 + children;

  return roots > capacity.roots && !fitsRootNodeCap(roots);
};

export const refusesRootNode = (zone: EditorZoneState | undefined): boolean =>
  zone !== undefined && !fitsRootNodeCap(zoneRootNodeCount(zone.nodes) + 1);
