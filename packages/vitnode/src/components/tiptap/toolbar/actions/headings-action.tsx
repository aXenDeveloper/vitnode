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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CtrlOrCommandCharacter } from "@/lib/ctrl-or-command-character";

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
  const activeValue = useEditorState({
    editor,
    selector: ctx => {
      if (!ctx.editor.isActive("heading")) return "paragraph";
      const level = ctx.editor.getAttributes("heading").level;

      return `heading-${level}`;
    },
  });

  const options = [
    {
      value: "paragraph",
      label: t("paragraph"),
      icon: ICONS.paragraph,
      shortcut: "0",
    },
    ...SUPPORTED_HEADINGS_LEVELS.map(level => ({
      value: `heading-${level}`,
      label: t("heading", { level }),
      icon: ICONS[`heading_${level}`],
      shortcut: level.toString(),
    })),
  ];
  const activeOption = options.find(o => o.value === activeValue) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="w-32 justify-between" size="sm" variant="ghost" />
        }
      >
        {activeOption.icon}
        {activeOption.label}

        <ChevronDown className="ml-auto" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="min-w-56">
        <DropdownMenuRadioGroup value={activeValue}>
          {options.map(item => (
            <DropdownMenuRadioItem
              key={item.value}
              onClick={() => {
                if (item.value === "paragraph") {
                  editor.chain().focus().setParagraph().run();
                } else {
                  const level = parseInt(item.value.split("-")[1]) as
                    1 | 2 | 3 | 4;
                  editor.chain().focus().toggleHeading({ level }).run();
                }
              }}
              value={item.value}
            >
              {item.icon}
              {item.label}
              <DropdownMenuShortcut>
                <CtrlOrCommandCharacter />
                +Alt+{item.shortcut}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
