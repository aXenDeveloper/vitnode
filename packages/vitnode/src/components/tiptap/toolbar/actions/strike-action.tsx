import { useEditorState } from "@tiptap/react";
import { StrikethroughIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { useToolbarEditor } from "../use-toolbar-editor";

export const StrikeAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isStrike } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isStrike: ctx.editor.isActive("strike"),
      };
    },
  });

  return (
    <TooltipWithContent text={t("strike")}>
      <div>
        <Toggle
          aria-label={t("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          pressed={isStrike}
        >
          <StrikethroughIcon />
        </Toggle>
      </div>
    </TooltipWithContent>
  );
};
