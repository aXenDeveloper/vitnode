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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CtrlOrCommandCharacter } from "@/lib/ctrl-or-command-character";
import { useToolbarEditor } from "../use-toolbar-editor";

export const AlignmentAction = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const activeValue = useEditorState({
    editor,
    selector: ctx => {
      return (
        ["left", "center", "right", "justify"].find(align =>
          ctx.editor.isActive({ textAlign: align }),
        ) || "left"
      );
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
  const activeAlignment =
    alignments.find(a => a.value === activeValue) || alignments[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="w-40 justify-between" variant="ghost">
          {activeAlignment.icon}
          {t(`alignments.${activeAlignment.value}`)}

          <ChevronDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-[16rem]">
        <DropdownMenuRadioGroup value={activeAlignment.value}>
          {alignments.map(item => (
            <DropdownMenuRadioItem
              key={item.value}
              onClick={() =>
                editor.chain().focus().setTextAlign(item.value).run()
              }
              value={item.value}
            >
              {item.icon}
              {t(`alignments.${item.value}`)}
              <DropdownMenuShortcut>
                <CtrlOrCommandCharacter />
                +Shift+{item.shortcut}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
