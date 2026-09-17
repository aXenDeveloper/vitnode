import { createContext, use } from "react";

import type { VisualEditorAction, VisualEditorState } from "./state/types";

export type EditorPanelMode = "area" | "blocks" | "properties";

export interface EditorInsertTarget {
  areaId: null | string;
  index: number;
  zoneId: string;
}

export interface EditorInsertRequest {
  areaId?: null | string;
  index?: number;
  type: string;
  zoneId?: string;
}

export interface EditorInsertAreaRequest {
  index?: number;
  zoneId?: string;
}

export type VisualEditorSaveStatus = "error" | "idle" | "saved" | "saving";

export interface VisualEditorContextValue {
  dirty: boolean;
  discard: () => void;
  dispatch: (action: VisualEditorAction) => void;
  exit: () => void;
  insertArea: (request?: EditorInsertAreaRequest) => void;
  insertBlock: (request: EditorInsertRequest) => void;
  insertTarget: EditorInsertTarget | null;
  panel: EditorPanelMode;
  preview: boolean;
  save: () => void;
  saveStatus: VisualEditorSaveStatus;
  setInsertTarget: (target: EditorInsertTarget | null) => void;
  setPanel: () => void;
  setPreview: (preview: boolean) => void;
  state: VisualEditorState;
  unsafeZoneIds: readonly string[];
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
