import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export const SUPPORTED_HEADINGS_LEVELS = [1, 2, 3, 4] as const;

export const tiptapExtensions: Extensions = [
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
  }),
];
