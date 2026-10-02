import { useEditorState } from "@tiptap/react";
import { cn } from "cn";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  CodeXmlIcon,
  EllipsisIcon,
  RemoveFormattingIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CtrlOrCommandCharacter } from "@/lib/ctrl-or-command-character";

import { useToolbarEditor } from "../../use-toolbar-editor";
import { ToolbarTooltip } from "../utils/toolbar-tooltip";

const ALIGNMENTS = [
  { value: "left", icon: <AlignLeftIcon />, shortcut: "L" },
  { value: "center", icon: <AlignCenterIcon />, shortcut: "E" },
  { value: "right", icon: <AlignRightIcon />, shortcut: "R" },
  { value: "justify", icon: <AlignJustifyIcon />, shortcut: "J" },
] as const;

export const TextFormatMore = () => {
  const t = useTranslations("core.global.editor");
  const { editor } = useToolbarEditor();
  const { isCode, isStrike, isUnderline, alignment } = useEditorState({
    editor,
    selector: ctx => ({
      isCode: ctx.editor.isActive("code"),
      isStrike: ctx.editor.isActive("strike"),
      isUnderline: ctx.editor.isActive("underline"),
      alignment:
        ALIGNMENTS.find(item => ctx.editor.isActive({ textAlign: item.value }))
          ?.value ?? "left",
    }),
  });
  const marks = [
    {
      id: "underline",
      label: t("underline"),
      icon: <UnderlineIcon />,
      shortcut: "+U",
      isActive: isUnderline,
      toggle: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      id: "strike",
      label: t("text_format_more.strike"),
      icon: <StrikethroughIcon />,
      shortcut: "+Shift+S",
      isActive: isStrike,
      toggle: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "code",
      label: t("text_format_more.code"),
      icon: <CodeXmlIcon />,
      shortcut: "+E",
      isActive: isCode,
      toggle: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  return (
    <DropdownMenu>
      <ToolbarTooltip text={t("text_format_more.label")}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("text_format_more.label")}
              className={cn({
                "bg-accent": isCode || isStrike || isUnderline,
              })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
      </ToolbarTooltip>

      <DropdownMenuContent className="min-w-60">
        {marks.map(mark => (
          <DropdownMenuItem
            className={cn({ "bg-accent": mark.isActive })}
            key={mark.id}
            onClick={mark.toggle}
          >
            {mark.icon}
            {mark.label}
            <DropdownMenuShortcut>
              <CtrlOrCommandCharacter />
              {mark.shortcut}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("alignments.label")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={alignment}>
            {ALIGNMENTS.map(item => (
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
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormattingIcon />
          {t("text_format_more.clear")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
