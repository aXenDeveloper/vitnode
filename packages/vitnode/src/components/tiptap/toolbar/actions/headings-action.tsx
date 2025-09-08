import { useEditorState } from "@tiptap/react";
import {
  ChevronDown,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  PilcrowIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
import { SUPPORTED_HEADINGS_LEVELS } from "../../extension";
import { useToolbarEditor } from "../use-toolbar-editor";

const ICONS = {
  paragraph: <PilcrowIcon />,
  heading_1: <Heading1Icon />,
  heading_2: <Heading2Icon />,
  heading_3: <Heading3Icon />,
  heading_4: <Heading4Icon />,
};

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
        <Button className="w-32 justify-between" variant="ghost">
          {isParagraph
            ? t("paragraph")
            : t("heading", {
                level:
                  SUPPORTED_HEADINGS_LEVELS.find(level =>
                    isHeaderActive(level),
                  ) ?? 1,
              })}

          <ChevronDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[12rem]" align="start">
        <DropdownMenuItem
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn({
            "bg-accent": isParagraph,
          })}
        >
          {ICONS.paragraph}
          {t("paragraph")}
          <DropdownMenuShortcut>
            <CtrlOrCommandCharacter />
            +Alt+0
          </DropdownMenuShortcut>
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
            {ICONS[`heading_${level}`]}
            {t("heading", { level })}
            <DropdownMenuShortcut>
              <CtrlOrCommandCharacter />
              +Alt+{level}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
