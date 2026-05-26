import type { Editor } from "@tiptap/react";

import { useMemo } from "react";

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
  const contextValue = useMemo(() => ({ editor }), [editor]);

  return (
    <ToolbarEditorContext value={contextValue}>
      <ScrollArea>
        <div className="flex h-14 items-center gap-1 border-b p-2 [&>div[data-slot='separator']]:mx-1">
          <UndoRedoActions />
          <Separator orientation="vertical" />
          <HeadingsAction />
          <Separator orientation="vertical" />
          <BoldAction />
          <ItalicAction />
          <UnderlineAction />
          <TextFormatMore />
          <AlignmentAction />
          <Separator orientation="vertical" />
          <ListAction />
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </ToolbarEditorContext>
  );
};
