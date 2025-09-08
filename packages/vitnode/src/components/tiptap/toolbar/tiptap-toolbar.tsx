import type { Editor } from "@tiptap/react";
import { Separator } from "@/components/ui/separator";
import { BoldAction } from "./actions/bold-action";
import { HeadingsAction } from "./actions/headings-action";
import { ItalicAction } from "./actions/italic-action";
import { TextFormatMore } from "./actions/text-format-more/text-format-more";
import { UnderlineAction } from "./actions/underline-action";
import { UndoRedoActions } from "./actions/undo-redo-actions";
import { ToolbarEditorContext } from "./use-toolbar-editor";

export const TipTapToolbar = ({ editor }: { editor: Editor }) => {
  return (
    <ToolbarEditorContext value={{ editor }}>
      <div className="border-b p-2 flex items-center flex-wrap h-14 gap-1">
        <UndoRedoActions />
        <Separator orientation="vertical" className="mx-2" />
        <HeadingsAction />
        <Separator orientation="vertical" className="mx-2" />
        <BoldAction />
        <ItalicAction />
        <UnderlineAction />

        <TextFormatMore />
      </div>
    </ToolbarEditorContext>
  );
};
