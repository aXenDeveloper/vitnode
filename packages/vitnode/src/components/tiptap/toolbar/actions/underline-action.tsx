import { useEditorState } from "@tiptap/react";
import { UnderlineIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useToolbarEditor } from "../use-toolbar-editor";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const UnderlineAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isUnderline } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isUnderline: ctx.editor.isActive("underline"),
      };
    },
  });

  return (
    <TooltipWithContent
      text={
        <>
          {t("underline")}
          <TooltipShortcut>+U</TooltipShortcut>
        </>
      }
    >
      <div>
        <Toggle
          aria-label={t("underline")}
          className="size-8"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          pressed={isUnderline}
          size="sm"
        >
          <UnderlineIcon />
        </Toggle>
      </div>
    </TooltipWithContent>
  );
};
