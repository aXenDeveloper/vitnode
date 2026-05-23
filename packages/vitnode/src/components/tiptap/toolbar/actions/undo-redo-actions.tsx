import { useEditorState } from "@tiptap/react";
import { RedoIcon, UndoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useToolbarEditor } from "../use-toolbar-editor";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const UndoRedoActions = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { canUndo, canRedo } = useEditorState({
    editor,
    selector: ctx => {
      return {
        canUndo: ctx.editor.can().chain().focus().undo().run(),
        canRedo: ctx.editor.can().chain().focus().redo().run(),
      };
    },
  });

  return (
    <>
      <TooltipWithContent
        text={
          <>
            {t("undo")} <TooltipShortcut>+Z</TooltipShortcut>
          </>
        }
      >
        <Button
          aria-label={t("undo")}
          disabled={!canUndo}
          onClick={() => editor.chain().focus().undo().run()}
          size="icon-sm"
          variant="ghost"
        >
          <UndoIcon />
        </Button>
      </TooltipWithContent>

      <TooltipWithContent
        text={
          <>
            {t("redo")} <TooltipShortcut>+Shift+Z</TooltipShortcut>
          </>
        }
      >
        <Button
          aria-label={t("redo")}
          disabled={!canRedo}
          onClick={() => editor.chain().focus().redo().run()}
          size="icon"
          variant="ghost"
        >
          <RedoIcon />
        </Button>
      </TooltipWithContent>
    </>
  );
};
