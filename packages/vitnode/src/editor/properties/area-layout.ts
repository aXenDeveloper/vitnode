import type { BlockAreaInstance, BlockAreaLayout } from "../../blocks/types";

import { areaLayoutWithDefaults } from "../../blocks/area";
import {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_JUSTIFIES,
  AREA_SPACING_MAX,
  AREA_SPACING_MIN,
} from "../../blocks/const";

export type AreaDeleteMode = "empty" | "holds-blocks";

export const AREA_LAYOUT_OPTIONS = {
  align: AREA_ALIGNS,
  columns: AREA_COLUMNS,
  justify: AREA_JUSTIFIES,
} as const;

export const AREA_SPACING_RANGE = {
  max: AREA_SPACING_MAX,
  min: AREA_SPACING_MIN,
} as const;

/** Keeps a dragged pixel value inside what an area may be stored with. */
export const clampAreaSpacing = (value: number): number =>
  Math.min(Math.max(Math.round(value), AREA_SPACING_MIN), AREA_SPACING_MAX);

export const nextAreaLayout = (
  layout: BlockAreaLayout,
  patch: Partial<BlockAreaLayout>,
): Required<BlockAreaLayout> => ({
  ...areaLayoutWithDefaults(layout),
  ...patch,
});

export const areaDeleteMode = (area: BlockAreaInstance): AreaDeleteMode =>
  area.children.length === 0 ? "empty" : "holds-blocks";
