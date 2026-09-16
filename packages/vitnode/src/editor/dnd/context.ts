import { createContext, use } from "react";

import type { EditorDragSource, EditorDropEdge } from "./resolve-drop";

export interface EditorDropIndicator {
  blockId: string;
  edge: EditorDropEdge;
}

export interface EditorDndContextValue {
  dragging: EditorDragSource | null;
  draggingType: null | string;
  dropIndicator: EditorDropIndicator | null;
}

const IDLE: EditorDndContextValue = {
  dragging: null,
  draggingType: null,
  dropIndicator: null,
};

export const EditorDndContext = createContext<EditorDndContextValue>(IDLE);

export const useEditorDnd = (): EditorDndContextValue => use(EditorDndContext);
