import { useEditorState } from "@tiptap/react";
import { CodeSquareIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Toggle } from "@/components/ui/toggle";

import { useToolbarEditor } from "../use-toolbar-editor";
import { ToolbarTooltip } from "./utils/toolbar-tooltip";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const CodeBlockAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const isCodeBlock = useEditorState({
    editor,
    selector: ctx => ctx.editor.isActive("codeBlock"),
  });

  return (
    <ToolbarTooltip
      text={
        <>
          {t("code_block")}
          <TooltipShortcut>+Alt+C</TooltipShortcut>
        </>
      }
    >
      <div>
        <Toggle
          aria-label={t("code_block")}
          className="size-8"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          pressed={isCodeBlock}
          size="sm"
        >
          <CodeSquareIcon />
        </Toggle>
      </div>
    </ToolbarTooltip>
  );
};
