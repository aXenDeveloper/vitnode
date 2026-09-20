import type { EditorInsertTarget } from "../context";

export type EditorInsertScope = "area" | "zone";

export const insertTargetScope = (
  target: EditorInsertTarget | null,
): EditorInsertScope | null => {
  if (target === null) return null;

  return target.areaId === null ? "zone" : "area";
};
