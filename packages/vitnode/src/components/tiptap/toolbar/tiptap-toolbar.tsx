import type { Editor } from "@tiptap/react";

import { useMemo } from "react";
import { useTranslations } from "use-intl";

import { Separator } from "@/components/ui/separator";
import { TooltipGroup } from "@/components/ui/tooltip";

import { BoldAction } from "./actions/bold-action";
import { CodeBlockAction } from "./actions/code-block-action";
import { ColorAction } from "./actions/color-action";
import { EmojiAction } from "./actions/emoji-action";
import { HeadingsAction } from "./actions/headings-action";
import { InsertAction } from "./actions/insert-action";
import { ItalicAction } from "./actions/italic-action";
import { LinkAction } from "./actions/link-action";
import { ListAction } from "./actions/list-action";
import { TableAction } from "./actions/table-action";
import { TextFormatMore } from "./actions/text-format-more/text-format-more";
import { useRovingToolbar } from "./use-roving-toolbar";
import { ToolbarEditorContext } from "./use-toolbar-editor";

export const TipTapToolbar = ({ editor }: { editor: Editor }) => {
  const t = useTranslations("core.global.editor");
  const contextValue = useMemo(() => ({ editor }), [editor]);
  const { onFocus, onKeyDown, ref: toolbarRef } = useRovingToolbar();

  return (
    <ToolbarEditorContext value={contextValue}>
      <TooltipGroup>
        <div
          aria-label={t("toolbar")}
          className="bg-card sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-md border-b p-1 *:data-[slot=separator]:mx-1 *:data-[slot=separator]:h-5 sm:flex-wrap"
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          ref={toolbarRef}
          role="toolbar"
        >
          <HeadingsAction />
          <Separator orientation="vertical" />
          <BoldAction />
          <ItalicAction />
          <TextFormatMore />
          <ColorAction />
          <Separator orientation="vertical" />
          <ListAction />
          <Separator orientation="vertical" />
          <LinkAction />
          <EmojiAction />
          <TableAction />
          <CodeBlockAction />
          <Separator orientation="vertical" />
          <InsertAction />
        </div>
      </TooltipGroup>
    </ToolbarEditorContext>
  );
};
