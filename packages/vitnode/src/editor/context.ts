import { createContext, use } from "react";

import type { VisualEditorAction, VisualEditorState } from "./state/types";

export interface BlockPickerTarget {
  index: number;
  zoneId: string;
}

export type VisualEditorSaveStatus = "error" | "idle" | "saved" | "saving";

export interface VisualEditorContextValue {
  dirty: boolean;
  discard: () => void;
  dispatch: (action: VisualEditorAction) => void;
  exit: () => void;
  openPicker: (target: BlockPickerTarget) => void;
  preview: boolean;
  save: () => void;
  saveStatus: VisualEditorSaveStatus;
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
