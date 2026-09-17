import type {
  AnyBlockInstance,
  BlockAreaAlign,
  BlockAreaColumns,
  BlockAreaGap,
  BlockAreaInstance,
  BlockAreaJustify,
  BlockAreaLayout,
  ContentNode,
} from "./types";

import {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_DEFAULT_ALIGN,
  AREA_DEFAULT_COLUMNS,
  AREA_DEFAULT_GAP,
  AREA_DEFAULT_JUSTIFY,
  AREA_GAPS,
  AREA_JUSTIFIES,
  CONTENT_AREA_KIND,
} from "./const";
import { createBlockInstanceId, isBlockInstanceId } from "./instance";

export const DEFAULT_AREA_LAYOUT: Required<BlockAreaLayout> = {
  align: AREA_DEFAULT_ALIGN,
  columns: AREA_DEFAULT_COLUMNS,
  gap: AREA_DEFAULT_GAP,
  justify: AREA_DEFAULT_JUSTIFY,
};

export const isAreaColumns = (value: unknown): value is BlockAreaColumns =>
  AREA_COLUMNS.some(column => column === value);

export const isAreaGap = (value: unknown): value is BlockAreaGap =>
  AREA_GAPS.some(gap => gap === value);

export const isAreaAlign = (value: unknown): value is BlockAreaAlign =>
  AREA_ALIGNS.some(align => align === value);

export const isAreaJustify = (value: unknown): value is BlockAreaJustify =>
  AREA_JUSTIFIES.some(justify => justify === value);

export const isAreaLayout = (value: unknown): value is BlockAreaLayout => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const layout = value as Record<string, unknown>;

  return (
    isAreaColumns(layout.columns) &&
    (layout.gap === undefined || isAreaGap(layout.gap)) &&
    (layout.align === undefined || isAreaAlign(layout.align)) &&
    (layout.justify === undefined || isAreaJustify(layout.justify))
  );
};

/**
 * True for anything that claims to be an area, whether or not what it claims
 * holds up. Classification comes before validation: a malformed area has to be
 * reported as a broken area, never quietly re-read as a block.
 */
export const isAreaLike = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>).kind === CONTENT_AREA_KIND;

export const isBlockAreaInstance = (
  value: unknown,
): value is BlockAreaInstance => {
  if (!isAreaLike(value)) return false;

  const area = value as Record<string, unknown>;

  return (
    isBlockInstanceId(area.id) &&
    isAreaLayout(area.layout) &&
    Array.isArray(area.children)
  );
};

export const areaLayoutWithDefaults = (
  layout: BlockAreaLayout,
): Required<BlockAreaLayout> => ({
  align: layout.align ?? DEFAULT_AREA_LAYOUT.align,
  columns: layout.columns,
  gap: layout.gap ?? DEFAULT_AREA_LAYOUT.gap,
  justify: layout.justify ?? DEFAULT_AREA_LAYOUT.justify,
});

export const createAreaInstance = ({
  children = [],
  layout,
}: {
  children?: readonly AnyBlockInstance[];
  layout?: Partial<BlockAreaLayout>;
} = {}): BlockAreaInstance => ({
  children: [...children],
  id: createBlockInstanceId(),
  kind: CONTENT_AREA_KIND,
  layout: { ...DEFAULT_AREA_LAYOUT, ...layout },
});

export const contentNodeId = (node: ContentNode): string => node.id;

export const areaChildren = (
  node: ContentNode,
): readonly AnyBlockInstance[] => (isBlockAreaInstance(node) ? node.children : []);

/** Every block in a tree, areas flattened in place, in stored order. */
export const contentNodeBlocks = (
  nodes: readonly ContentNode[],
): readonly AnyBlockInstance[] =>
  nodes.flatMap(node =>
    isBlockAreaInstance(node) ? [...node.children] : [node],
  );
