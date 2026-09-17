import type { VisualEditorSaveStatus } from "../context";

export type EditorStatus = "failed" | "saved" | "saving" | "unsaved";

export const editorStatus = (
  dirty: boolean,
  saveStatus: VisualEditorSaveStatus,
): EditorStatus => {
  if (saveStatus === "saving") return "saving";
  if (saveStatus === "error") return "failed";

  return dirty ? "unsaved" : "saved";
};
