import type { EditorDragSource, EditorDropIndicator } from "./resolve-drop";

import { isCatalogSource } from "./resolve-drop";

export const dropSlotFor = (
  dragging: EditorDragSource | null,
  indicator: EditorDropIndicator | null,
): EditorDropIndicator | null => {
  if (dragging === null || indicator === null) return null;
  if (indicator.axis !== "vertical") return null;
  if (isCatalogSource(dragging)) return indicator;

  const { container } = dragging;

  return container.zoneId === indicator.zoneId &&
    container.areaId === indicator.areaId
    ? null
    : indicator;
};

export const sameSlot = (
  left: EditorDropIndicator | null,
  right: EditorDropIndicator | null,
): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.nodeId === right.nodeId &&
    left.edge === right.edge &&
    left.zoneId === right.zoneId &&
    left.areaId === right.areaId);
