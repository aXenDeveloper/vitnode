import { useEditorState } from "@tiptap/react";
import { BoldIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useToolbarEditor } from "../use-toolbar-editor";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const BoldAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isBold } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive("bold"),
      };
    },
  });

  return (
    <TooltipWithContent
      text={
        <>
          {t("bold")} <TooltipShortcut>+B</TooltipShortcut>
        </>
      }
    >
      <div>
        <Toggle
          aria-label={t("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          pressed={isBold}
        >
          <BoldIcon />
        </Toggle>
      </div>
    </TooltipWithContent>
  );
};
