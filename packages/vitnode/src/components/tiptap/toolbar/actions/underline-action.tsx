import { useEditorState } from "@tiptap/react";
import { UnderlineIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { useToolbarEditor } from "../use-toolbar-editor";

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
    <TooltipWithContent text={t("underline")}>
      <div>
        <Toggle
          aria-label={t("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          pressed={isUnderline}
        >
          <UnderlineIcon />
        </Toggle>
      </div>
    </TooltipWithContent>
  );
};
