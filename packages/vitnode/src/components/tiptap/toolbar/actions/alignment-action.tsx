import { useEditorState } from "@tiptap/react";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDown,
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
import { useToolbarEditor } from "../use-toolbar-editor";

export const AlignmentAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isAlignActive } = useEditorState({
    editor,
    selector: ctx => {
      return {
        isAlignActive: () => {
          if (ctx.editor.isActive({ textAlign: "left" })) {
            return "left";
          }

          if (ctx.editor.isActive({ textAlign: "center" })) {
            return "center";
          }
          if (ctx.editor.isActive({ textAlign: "right" })) {
            return "right";
          }
          if (ctx.editor.isActive({ textAlign: "justify" })) {
            return "justify";
          }

          return "left";
        },
      };
    },
  });

  const alignments = [
    {
      label: t("alignments.left"),
      value: "left" as const,
      icon: <AlignLeftIcon />,
      shortcut: "L",
    },
    {
      label: t("alignments.center"),
      value: "center" as const,
      icon: <AlignCenterIcon />,
      shortcut: "E",
    },
    {
      label: t("alignments.right"),
      value: "right" as const,
      icon: <AlignRightIcon />,
      shortcut: "R",
    },
    {
      label: t("alignments.justify"),
      value: "justify" as const,
      icon: <AlignJustifyIcon />,
      shortcut: "J",
    },
  ];
  const activeAlignment = alignments.find(a => a.value === isAlignActive());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-40 justify-between" variant="ghost">
          {activeAlignment?.icon ?? <AlignLeftIcon />}
          {t(`alignments.${activeAlignment?.value ?? "left"}`)}

          <ChevronDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[14rem]">
        {alignments.map(item => (
          <DropdownMenuItem
            key={item.value}
            onClick={() =>
              editor.chain().focus().setTextAlign(item.value).run()
            }
            className={cn({
              "bg-accent": activeAlignment?.value === item.value,
            })}
          >
            {item.icon}
            {t(`alignments.${item.value}`)}
            <DropdownMenuShortcut>
              <CtrlOrCommandCharacter />
              +Shift+{item.shortcut}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
