import type { Editor } from "@tiptap/react";

import React from "react";

export const ToolbarEditorContext = React.createContext<{
  editor: Editor;
}>({
  editor: {} as Editor,
});

export const useToolbarEditor = () => React.use(ToolbarEditorContext);
