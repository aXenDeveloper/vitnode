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
          size="icon"
          aria-label={t("undo")}
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!canUndo}
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
          size="icon"
          aria-label={t("redo")}
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!canRedo}
        >
          <RedoIcon />
        </Button>
      </TooltipWithContent>
    </>
  );
};
