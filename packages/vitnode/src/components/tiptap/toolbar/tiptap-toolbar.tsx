import type { Editor } from "@tiptap/react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlignmentAction } from "./actions/alignment-action";
import { BoldAction } from "./actions/bold-action";
import { HeadingsAction } from "./actions/headings-action";
import { ItalicAction } from "./actions/italic-action";
import { ListAction } from "./actions/list-action";
import { TextFormatMore } from "./actions/text-format-more/text-format-more";
import { UnderlineAction } from "./actions/underline-action";
import { UndoRedoActions } from "./actions/undo-redo-actions";
import { ToolbarEditorContext } from "./use-toolbar-editor";

export const TipTapToolbar = ({ editor }: { editor: Editor }) => {
  return (
    <ToolbarEditorContext value={{ editor }}>
      <ScrollArea>
        <div className="border-b p-2 flex items-center h-14 gap-1">
          <UndoRedoActions />
          <Separator orientation="vertical" className="mx-2" />
          <HeadingsAction />
          <Separator orientation="vertical" className="mx-2" />
          <BoldAction />
          <ItalicAction />
          <UnderlineAction />
          <TextFormatMore />
          <AlignmentAction />
          <Separator orientation="vertical" className="mx-2" />
          <ListAction />
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </ToolbarEditorContext>
  );
};
