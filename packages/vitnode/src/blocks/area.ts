import type {
  AnyBlockInstance,
  AreaLegacySpacing,
  BlockAreaAlign,
  BlockAreaColumns,
  BlockAreaInstance,
  BlockAreaJustify,
  BlockAreaLayout,
  BlockAreaStoredLayout,
  ContentNode,
} from "./types";

import {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_DEFAULT_ALIGN,
  AREA_DEFAULT_COLUMNS,
  AREA_DEFAULT_GAP,
  AREA_DEFAULT_JUSTIFY,
  AREA_DEFAULT_MARGIN,
  AREA_JUSTIFIES,
  AREA_LEGACY_SPACING,
  AREA_SPACING_MAX,
  AREA_SPACING_MIN,
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
  marginX: AREA_DEFAULT_MARGIN,
  marginY: AREA_DEFAULT_MARGIN,
};

export const isAreaColumns = (value: unknown): value is BlockAreaColumns =>
  AREA_COLUMNS.some(column => column === value);

/** A spacing as it is written down now: whole pixels, 0 to 100. */
export const isAreaSpacing = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= AREA_SPACING_MIN &&
  value <= AREA_SPACING_MAX;

export const isLegacyAreaSpacing = (
  value: unknown,
): value is AreaLegacySpacing =>
  typeof value === "string" && Object.hasOwn(AREA_LEGACY_SPACING, value);

/** Either spelling, as it is stored - a number, or one of the old names. */
export const isStoredAreaSpacing = (value: unknown): boolean =>
  isAreaSpacing(value) || isLegacyAreaSpacing(value);

export const areaSpacing = (value: unknown, fallback: number): number => {
  if (isAreaSpacing(value)) return value;

  return isLegacyAreaSpacing(value) ? AREA_LEGACY_SPACING[value] : fallback;
};

export const isAreaAlign = (value: unknown): value is BlockAreaAlign =>
  AREA_ALIGNS.some(align => align === value);

export const isAreaJustify = (value: unknown): value is BlockAreaJustify =>
  AREA_JUSTIFIES.some(justify => justify === value);

export const isAreaLayout = (
  value: unknown,
): value is BlockAreaStoredLayout => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const layout = value as Record<string, unknown>;

  return (
    isAreaColumns(layout.columns) &&
    (layout.gap === undefined || isStoredAreaSpacing(layout.gap)) &&
    (layout.align === undefined || isAreaAlign(layout.align)) &&
    (layout.justify === undefined || isAreaJustify(layout.justify)) &&
    (layout.marginX === undefined || isStoredAreaSpacing(layout.marginX)) &&
    (layout.marginY === undefined || isStoredAreaSpacing(layout.marginY))
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
  layout: BlockAreaStoredLayout,
): Required<BlockAreaLayout> => ({
  align: isAreaAlign(layout.align) ? layout.align : DEFAULT_AREA_LAYOUT.align,
  columns: isAreaColumns(layout.columns)
    ? layout.columns
    : DEFAULT_AREA_LAYOUT.columns,
  gap: areaSpacing(layout.gap, DEFAULT_AREA_LAYOUT.gap),
  justify: isAreaJustify(layout.justify)
    ? layout.justify
    : DEFAULT_AREA_LAYOUT.justify,
  marginX: areaSpacing(layout.marginX, DEFAULT_AREA_LAYOUT.marginX),
  marginY: areaSpacing(layout.marginY, DEFAULT_AREA_LAYOUT.marginY),
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

/**
 * The parts of a layout that are a number somebody picked rather than a token.
 *
 * Inline rather than a class, because these are pixels chosen per area: a
 * utility for each of the 101 values they could hold would be a stylesheet, and
 * an arbitrary-value class would be one this repository does not write.
 *
 * Typed structurally so nothing here has to reach for React's `CSSProperties` -
 * `blocks/area.ts` is read by the API and the editor alike, and a boundary test
 * holds it to importing nothing at all.
 */
export interface AreaSpacingStyle {
  gap?: string;
  marginBlock?: string;
  marginInline?: string;
}

const px = (value: number): string => `${String(value)}px`;

export const areaLayoutStyle = (
  layout: BlockAreaStoredLayout,
): AreaSpacingStyle => ({
  gap: px(areaLayoutWithDefaults(layout).gap),
});

/**
 * The room an area keeps around itself, or nothing when it asks for none -
 * which is what lets a renderer leave the wrapper out and keep the markup an
 * area laid out before margins existed has always had.
 */
export const areaMarginStyle = (
  layout: BlockAreaStoredLayout,
): AreaSpacingStyle | undefined => {
  const { marginX, marginY } = areaLayoutWithDefaults(layout);

  if (marginX === 0 && marginY === 0) return undefined;

  return { marginBlock: px(marginY), marginInline: px(marginX) };
};

export const areaLayoutClassNames = (
  layout: BlockAreaStoredLayout,
): string => {
  const resolved = areaLayoutWithDefaults(layout);

  return [
    AREA_GRID_CLASS,
    AREA_COLUMN_CLASSES[resolved.columns],
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
