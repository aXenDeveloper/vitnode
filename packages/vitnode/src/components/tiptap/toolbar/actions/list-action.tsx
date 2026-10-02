import { useEditorState } from "@tiptap/react";
import { ListChecksIcon, ListIcon, ListOrderedIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Toggle } from "@/components/ui/toggle";

import { useToolbarEditor } from "../use-toolbar-editor";
import { ToolbarTooltip } from "./utils/toolbar-tooltip";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const ListAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isBulletList, isOrderedList, isTaskList } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isOrderedList: ctx.editor.isActive("orderedList"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isTaskList: ctx.editor.isActive("taskList"),
      };
    },
  });

  return (
    <>
      <ToolbarTooltip
        text={
          <>
            {t("bullet_list")}
            <TooltipShortcut>+Shift+8</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("bullet_list")}
            className="size-8"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            pressed={isBulletList}
            size="sm"
          >
            <ListIcon />
          </Toggle>
        </div>
      </ToolbarTooltip>

      <ToolbarTooltip
        text={
          <>
            {t("ordered_list")}
            <TooltipShortcut>+Shift+7</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("ordered_list")}
            className="size-8"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            pressed={isOrderedList}
            size="sm"
          >
            <ListOrderedIcon />
          </Toggle>
        </div>
      </ToolbarTooltip>

      <ToolbarTooltip
        text={
          <>
            {t("task_list")}
            <TooltipShortcut>+Shift+9</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("task_list")}
            className="size-8"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            pressed={isTaskList}
            size="sm"
          >
            <ListChecksIcon />
          </Toggle>
        </div>
      </ToolbarTooltip>
    </>
  );
};
