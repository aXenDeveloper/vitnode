import type { Editor } from "@tiptap/react";
import { HeadingsAction } from "./actions/headings-action";
import { UndoRedoActions } from "./actions/undo-redo-actions";
import { ToolbarEditorContext } from "./use-toolbar-editor";

export const TipTapToolbar = ({ editor }: { editor: Editor }) => {
  return (
    <ToolbarEditorContext value={{ editor }}>
      <div className="border-b p-2 flex items-center flex-wrap">
        <UndoRedoActions />
        <HeadingsAction />
      </div>
    </ToolbarEditorContext>
  );
};
