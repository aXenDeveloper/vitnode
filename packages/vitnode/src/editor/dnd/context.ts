import { createContext, use } from "react";

import type { EditorDragSource, EditorDropIndicator } from "./resolve-drop";

export type { EditorDropIndicator } from "./resolve-drop";

export interface EditorDndContextValue {
  dragging: EditorDragSource | null;
  dropIndicator: EditorDropIndicator | null;
}

const IDLE: EditorDndContextValue = {
  dragging: null,
  dropIndicator: null,
};

export const EditorDndContext = createContext<EditorDndContextValue>(IDLE);

export const useEditorDnd = (): EditorDndContextValue => use(EditorDndContext);
