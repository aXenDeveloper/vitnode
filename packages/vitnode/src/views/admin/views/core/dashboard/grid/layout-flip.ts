import type { LayoutFlipTarget, LayoutSnapshot } from "@/lib/dnd/layout-flip";

import {
  playLayoutFlip as playFlip,
  snapshotLayout as snapshot,
} from "@/lib/dnd/layout-flip";

export type { LayoutSnapshot } from "@/lib/dnd/layout-flip";

const WIDGETS: LayoutFlipTarget = {
  keyOf: node => node.dataset.dashboardWidget,
  selector: "[data-dashboard-widget]",
};

export const snapshotLayout = (grid: HTMLElement | null) =>
  snapshot(grid, WIDGETS);

export const playLayoutFlip = (
  grid: HTMLElement | null,
  before: LayoutSnapshot | null,
): void => {
  playFlip(grid, before, WIDGETS);
};
