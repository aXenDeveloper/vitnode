import { useEditorState } from "@tiptap/react";
import { BaselineIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { ColorPresetPicker } from "@/components/ui/color-preset-picker";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useToolbarEditor } from "../use-toolbar-editor";

export const ColorAction = () => {
  const t = useTranslations("core.global.editor.color");
  const { editor } = useToolbarEditor();
  const activeColor = useEditorState({
    editor,
    selector: ctx => {
      const color: unknown = ctx.editor.getAttributes("textStyle").color;

      return typeof color === "string" ? color : "";
    },
  });

  const setColor = (color: string) => {
    if (!color) {
      editor.chain().focus().unsetColor().run();

      return;
    }

    editor.chain().focus().setColor(color).run();
  };

  return (
    <Popover>
      <TooltipWithContent text={t("label")}>
        <PopoverTrigger
          render={
            <Button
              aria-label={t("label")}
              className="flex-col gap-0.5"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <BaselineIcon className="-mb-0.5" />
          <span
            className="border-input h-1 w-4.5 rounded-full border"
            style={{ backgroundColor: activeColor || "currentColor" }}
          />
        </PopoverTrigger>
      </TooltipWithContent>

      <PopoverContent className="w-auto gap-3">
        <PopoverTitle>{t("label")}</PopoverTitle>

        <ColorPresetPicker onChange={setColor} value={activeColor} />

        <Button
          disabled={!activeColor}
          onClick={() => editor.chain().focus().unsetColor().run()}
          size="sm"
          type="button"
          variant="outline"
        >
          <XIcon />
          {t("remove")}
        </Button>
      </PopoverContent>
    </Popover>
  );
};
