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
import {
  createBlockInstanceId,
  isBlockInstance,
  isBlockInstanceId,
} from "./instance";

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

export const isContentNode = (value: unknown): value is ContentNode =>
  isBlockAreaInstance(value) || isBlockInstance(value);

export const areaLayoutWithDefaults = (
  layout: BlockAreaLayout,
): Required<BlockAreaLayout> => ({
  align: isAreaAlign(layout.align) ? layout.align : DEFAULT_AREA_LAYOUT.align,
  columns: isAreaColumns(layout.columns)
    ? layout.columns
    : DEFAULT_AREA_LAYOUT.columns,
  gap: isAreaGap(layout.gap) ? layout.gap : DEFAULT_AREA_LAYOUT.gap,
  justify: isAreaJustify(layout.justify)
    ? layout.justify
    : DEFAULT_AREA_LAYOUT.justify,
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
  layout: areaLayoutWithDefaults({ ...DEFAULT_AREA_LAYOUT, ...layout }),
});

export const AREA_GRID_CLASS = "grid";

export const AREA_COLUMN_CLASSES = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-4",
} as const satisfies Record<BlockAreaColumns, string>;

export const AREA_GAP_CLASSES = {
  lg: "gap-8",
  md: "gap-4",
  none: "gap-0",
  sm: "gap-2",
} as const satisfies Record<BlockAreaGap, string>;

export const AREA_ALIGN_CLASSES = {
  center: "items-center",
  start: "items-start",
  stretch: "items-stretch",
} as const satisfies Record<BlockAreaAlign, string>;

export const AREA_JUSTIFY_CLASSES = {
  center: "justify-items-center",
  start: "justify-items-start",
  stretch: "justify-items-stretch",
} as const satisfies Record<BlockAreaJustify, string>;

export const areaLayoutClassNames = (layout: BlockAreaLayout): string => {
  const resolved = areaLayoutWithDefaults(layout);

  return [
    AREA_GRID_CLASS,
    AREA_COLUMN_CLASSES[resolved.columns],
    AREA_GAP_CLASSES[resolved.gap],
    AREA_ALIGN_CLASSES[resolved.align],
    AREA_JUSTIFY_CLASSES[resolved.justify],
  ].join(" ");
};

export const contentNodeId = (node: ContentNode): string => node.id;

export const areaLikeId = (value: unknown): string | undefined => {
  if (!isAreaLike(value)) return undefined;

  const id = (value as Record<string, unknown>).id;

  return typeof id === "string" && id.length > 0 ? id : undefined;
};

export const contentNodeKey = (node: unknown, index: number): string => {
  const at = `at:${String(index)}`;

  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return at;
  }

  const id = (node as Record<string, unknown>).id;

  return typeof id === "string" && id.length > 0 ? id : at;
};

export const areaChildren = (node: ContentNode): readonly AnyBlockInstance[] =>
  isBlockAreaInstance(node) ? node.children : [];

export const contentNodeBlocks = (
  nodes: readonly ContentNode[],
): readonly AnyBlockInstance[] =>
  nodes.flatMap(node =>
    isBlockAreaInstance(node) ? [...node.children] : [node],
  );
