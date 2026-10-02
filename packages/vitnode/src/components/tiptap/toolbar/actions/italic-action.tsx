import { useEditorState } from "@tiptap/react";
import { ItalicIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Toggle } from "@/components/ui/toggle";

import { useToolbarEditor } from "../use-toolbar-editor";
import { ToolbarTooltip } from "./utils/toolbar-tooltip";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const ItalicAction = () => {
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
    <ToolbarTooltip
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
          className="size-8"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          pressed={isItalic}
          size="sm"
        >
          <ItalicIcon />
        </Toggle>
      </div>
    </ToolbarTooltip>
  );
};
