import { createContext, use } from "react";

import type { VisualEditorAction, VisualEditorState } from "./state/types";

export type EditorPanelMode = "blocks" | "properties";

export interface EditorInsertTarget {
  index: number;
  zoneId: string;
}

export interface EditorInsertRequest {
  index?: number;
  type: string;
  zoneId?: string;
}

export type VisualEditorSaveStatus = "error" | "idle" | "saved" | "saving";

export interface VisualEditorContextValue {
  dirty: boolean;
  discard: () => void;
  dispatch: (action: VisualEditorAction) => void;
  exit: () => void;
  insertBlock: (request: EditorInsertRequest) => void;
  insertTarget: EditorInsertTarget | null;
  panel: EditorPanelMode;
  preview: boolean;
  save: () => void;
  saveStatus: VisualEditorSaveStatus;
  setInsertTarget: (target: EditorInsertTarget | null) => void;
  setPanel: (panel: EditorPanelMode) => void;
  setPreview: (preview: boolean) => void;
  state: VisualEditorState;
}

export const VisualEditorContext =
  createContext<null | VisualEditorContextValue>(null);

export const useVisualEditor = (): VisualEditorContextValue => {
  const value = use(VisualEditorContext);

  if (!value) {
    throw new Error(
      "A visual editor component was rendered outside `<ContentEditorRuntime enabled />`. Editor UI only exists while edit mode is on - render it from inside the editor runtime, never from a public page.",
    );
  }

  return value;
};
