import type { Extensions } from "@tiptap/react";

import { Audio } from "@tiptap/extension-audio";
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Typography } from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";

import type { EditorEmojiSection } from "@/components/editor-provider";

import { customEmojiToTipTap } from "./emoji/custom-emoji";
import { emojiSuggestion } from "./emoji/emoji-suggestion";
import { Panel } from "./panel";
import { SlashCommand } from "./slash-command/slash-command";
import { SubmitFormShortcut } from "./submit-form-shortcut";

export const SUPPORTED_HEADINGS_LEVELS = [1, 2, 3, 4] as const;

export const createTipTapExtensions = ({
  customEmojis,
  placeholder,
}: {
  customEmojis?: EditorEmojiSection[];
  placeholder?: string;
} = {}): Extensions => [
  StarterKit.configure({
    orderedList: {
      HTMLAttributes: {
        class: "list-decimal",
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: "list-disc",
      },
    },
    heading: {
      levels: [...SUPPORTED_HEADINGS_LEVELS],
    },
    dropcursor: {
      class: "tiptap-dropcursor",
      color: "var(--color-primary)",
      width: 2,
    },
    trailingNode: {
      node: "paragraph",
      notAfter: ["paragraph"],
    },
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  TextStyle,
  Color,
  FontSize,
  Typography,
  Placeholder.configure({
    placeholder: placeholder ?? "",
  }),
  Audio.configure({
    HTMLAttributes: {
      class: "tiptap-audio",
    },
  }),
  Emoji.configure({
    emojis: [...gitHubEmojis, ...customEmojiToTipTap(customEmojis)],
    suggestion: emojiSuggestion,
  }),
  TableKit.configure({
    table: {
      renderWrapper: true,
      resizable: true,
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Panel,
  SlashCommand,
  SubmitFormShortcut,
];
