import { useEditorState } from "@tiptap/react";
import { ListIcon, ListOrderedIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useToolbarEditor } from "../use-toolbar-editor";
import { TooltipShortcut } from "./utils/tooltip-shortcut";

export const ListAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isBulletList, isOrderedList } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isOrderedList: ctx.editor.isActive("orderedList"),
        isBulletList: ctx.editor.isActive("bulletList"),
      };
    },
  });

  return (
    <>
      <TooltipWithContent
        text={
          <>
            {t("bullet_list")}
            <TooltipShortcut>+I</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("bullet_list")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            pressed={isBulletList}
          >
            <ListIcon />
          </Toggle>
        </div>
      </TooltipWithContent>

      <TooltipWithContent
        text={
          <>
            {t("ordered_list")}
            <TooltipShortcut>+I</TooltipShortcut>
          </>
        }
      >
        <div>
          <Toggle
            aria-label={t("ordered_list")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            pressed={isOrderedList}
          >
            <ListOrderedIcon />
          </Toggle>
        </div>
      </TooltipWithContent>
    </>
  );
};
