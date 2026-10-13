import type { ReactNode } from "react";

import { createContext, use } from "react";

import type { EditorDragSource, EditorDropIndicator } from "./resolve-drop";

export type { EditorDropIndicator } from "./resolve-drop";

export interface EditorDndContextValue {
  dragging: EditorDragSource | null;
  dragHeight: number;
  dropIndicator: EditorDropIndicator | null;
  dropSlot: EditorDropIndicator | null;
  slotLabel: null | { icon: ReactNode; name: string };
}

const IDLE: EditorDndContextValue = {
  dragging: null,
  dragHeight: 0,
  dropIndicator: null,
  dropSlot: null,
  slotLabel: null,
};

export const EditorDndContext = createContext<EditorDndContextValue>(IDLE);

export const useEditorDnd = (): EditorDndContextValue => use(EditorDndContext);
