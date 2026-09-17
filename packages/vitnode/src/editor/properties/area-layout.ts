import type { BlockAreaInstance, BlockAreaLayout } from "../../blocks/types";

import { areaLayoutWithDefaults } from "../../blocks/area";
import {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_GAPS,
  AREA_JUSTIFIES,
} from "../../blocks/const";

export type AreaDeleteMode = "empty" | "holds-blocks";

export const AREA_LAYOUT_OPTIONS = {
  align: AREA_ALIGNS,
  columns: AREA_COLUMNS,
  gap: AREA_GAPS,
  justify: AREA_JUSTIFIES,
} as const;

export const nextAreaLayout = (
  layout: BlockAreaLayout,
  patch: Partial<BlockAreaLayout>,
): Required<BlockAreaLayout> => ({
  ...areaLayoutWithDefaults(layout),
  ...patch,
});

export const areaDeleteMode = (area: BlockAreaInstance): AreaDeleteMode =>
  area.children.length === 0 ? "empty" : "holds-blocks";
