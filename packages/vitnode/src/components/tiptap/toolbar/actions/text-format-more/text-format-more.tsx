import { useEditorState } from "@tiptap/react";
import { EllipsisVerticalIcon, StrikethroughIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CtrlOrCommandCharacter } from "@/lib/ctrl-or-command-character";
import { cn } from "@/lib/utils";

import { useToolbarEditor } from "../../use-toolbar-editor";

export const TextFormatMore = () => {
  const t = useTranslations("core.global.editor.text_format_more");
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("label")}
            className={cn({
              "bg-accent": isStrike,
            })}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-48">
        <DropdownMenuItem
          className={cn({
            "bg-accent": isStrike,
          })}
          onClick={() => {
            editor.chain().focus().toggleStrike().run();
            editor.view.focus();
          }}
        >
          <StrikethroughIcon />
          {t("strike")}
          <DropdownMenuShortcut>
            <CtrlOrCommandCharacter />
            +S
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
