import type { Editor } from "@tiptap/react";

import {
  CircleCheckIcon,
  CodeSquareIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  InfoIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  OctagonAlertIcon,
  PilcrowIcon,
  QuoteIcon,
  SmileIcon,
  TableIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { togglePanel } from "./panel";

export const BLOCK_COMMAND_GROUPS = ["text", "lists", "insert"] as const;

export type BlockCommandGroup = (typeof BLOCK_COMMAND_GROUPS)[number];

export type BlockCommandId =
  | "bullet_list"
  | "code_block"
  | "divider"
  | "emoji"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "ordered_list"
  | "panel_error"
  | "panel_info"
  | "panel_success"
  | "panel_warning"
  | "paragraph"
  | "quote"
  | "table"
  | "task_list";

export interface BlockCommand {
  group: BlockCommandGroup;
  icon: React.ReactNode;
  id: BlockCommandId;
  keywords: string[];
  run: (editor: Editor) => void;
}

export const BLOCK_COMMANDS: BlockCommand[] = [
  {
    id: "paragraph",
    group: "text",
    icon: <PilcrowIcon />,
    keywords: ["text", "normal", "paragraph"],
    run: editor => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "heading_1",
    group: "text",
    icon: <Heading1Icon />,
    keywords: ["h1", "heading", "title"],
    run: editor => editor.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: "heading_2",
    group: "text",
    icon: <Heading2Icon />,
    keywords: ["h2", "heading", "subtitle"],
    run: editor => editor.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: "heading_3",
    group: "text",
    icon: <Heading3Icon />,
    keywords: ["h3", "heading"],
    run: editor => editor.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: "quote",
    group: "text",
    icon: <QuoteIcon />,
    keywords: ["quote", "blockquote", "citation"],
    run: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "bullet_list",
    group: "lists",
    icon: <ListIcon />,
    keywords: ["bullet", "list", "ul", "unordered"],
    run: editor => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered_list",
    group: "lists",
    icon: <ListOrderedIcon />,
    keywords: ["numbered", "list", "ol", "ordered"],
    run: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task_list",
    group: "lists",
    icon: <ListChecksIcon />,
    keywords: ["task", "todo", "checkbox", "list"],
    run: editor => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "code_block",
    group: "insert",
    icon: <CodeSquareIcon />,
    keywords: ["code", "snippet", "pre"],
    run: editor => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "table",
    group: "insert",
    icon: <TableIcon />,
    keywords: ["table", "grid", "rows"],
    run: editor =>
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "divider",
    group: "insert",
    icon: <MinusIcon />,
    keywords: ["divider", "hr", "line", "separator"],
    run: editor => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "emoji",
    group: "insert",
    icon: <SmileIcon />,
    keywords: ["emoji", "smile", "reaction"],
    run: editor => editor.chain().focus().insertContent(":").run(),
  },
  {
    id: "panel_info",
    group: "insert",
    icon: <InfoIcon />,
    keywords: ["panel", "info", "note", "callout"],
    run: editor => togglePanel(editor, "info"),
  },
  {
    id: "panel_warning",
    group: "insert",
    icon: <TriangleAlertIcon />,
    keywords: ["panel", "warning", "caution", "callout"],
    run: editor => togglePanel(editor, "warning"),
  },
  {
    id: "panel_success",
    group: "insert",
    icon: <CircleCheckIcon />,
    keywords: ["panel", "success", "done", "callout"],
    run: editor => togglePanel(editor, "success"),
  },
  {
    id: "panel_error",
    group: "insert",
    icon: <OctagonAlertIcon />,
    keywords: ["panel", "error", "danger", "callout"],
    run: editor => togglePanel(editor, "error"),
  },
];

export const matchBlockCommands = ({
  commands,
  query,
  getTitle,
}: {
  commands: BlockCommand[];
  getTitle: (command: BlockCommand) => string;
  query: string;
}): BlockCommand[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;

  return commands.filter(
    command =>
      getTitle(command).toLowerCase().includes(needle) ||
      command.keywords.some(keyword => keyword.startsWith(needle)),
  );
};
