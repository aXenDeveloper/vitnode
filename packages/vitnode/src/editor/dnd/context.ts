import { createContext, use } from "react";

export interface EditorDndContextValue {
  draggingBlockId: null | string;
  draggingType: null | string;
}

const IDLE: EditorDndContextValue = {
  draggingBlockId: null,
  draggingType: null,
};

export const EditorDndContext = createContext<EditorDndContextValue>(IDLE);

export const useEditorDnd = (): EditorDndContextValue => use(EditorDndContext);
