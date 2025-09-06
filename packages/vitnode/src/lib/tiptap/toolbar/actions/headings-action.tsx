import { useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SUPPORTED_HEADINGS_LEVELS } from "../../extension";
import { useToolbarEditor } from "../use-toolbar-editor";

export const HeadingsAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isParagraph, isHeaderActive } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isParagraph: !ctx.editor.isActive("heading"),
        isHeaderActive: (level: number) =>
          ctx.editor.isActive("heading", { level }),
      };
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          {isParagraph
            ? t("paragraph")
            : t("heading", {
                level:
                  SUPPORTED_HEADINGS_LEVELS.find(level =>
                    isHeaderActive(level),
                  ) ?? 1,
              })}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn({
            "bg-accent": isParagraph,
          })}
        >
          {t("paragraph")}
        </DropdownMenuItem>

        {SUPPORTED_HEADINGS_LEVELS.map(level => (
          <DropdownMenuItem
            key={level}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
            className={cn({
              "bg-accent": isHeaderActive(level),
            })}
          >
            {t("heading", { level })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
