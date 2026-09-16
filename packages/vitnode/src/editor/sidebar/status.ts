import type { VisualEditorSaveStatus } from "../context";

export type EditorStatus = "error" | "idle" | "saved" | "saving" | "unsaved";

export const editorStatus = (
  dirty: boolean,
  saveStatus: VisualEditorSaveStatus,
): EditorStatus => {
  if (saveStatus === "saving") return "saving";
  if (saveStatus === "error") return "error";
  if (dirty) return "unsaved";

  return saveStatus === "saved" ? "saved" : "idle";
};
