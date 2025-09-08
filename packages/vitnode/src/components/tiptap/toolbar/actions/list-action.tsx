import { useEditorState } from "@tiptap/react";
import { ItalicIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { useToolbarEditor } from "../use-toolbar-editor";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const ListAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isItalic } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isItalic: ctx.editor.isActive("italic"),
      };
    },
  });

  return (
    <>
      <TooltipWithContent
        text={
          <>
            {t("italic")}
            <TooltipShortcut>+I</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            pressed={isItalic}
          >
            <ItalicIcon />
          </Toggle>
        </div>
      </TooltipWithContent>

      <TooltipWithContent
        text={
          <>
            {t("italic")}
            <TooltipShortcut>+I</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            pressed={isItalic}
          >
            <ItalicIcon />
          </Toggle>
        </div>
      </TooltipWithContent>
    </>
  );
};
