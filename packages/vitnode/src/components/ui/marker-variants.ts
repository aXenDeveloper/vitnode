import { cva } from "class-variance-authority";

import { FEEDBACK_TONE_TEXT } from "./feedback-tone";

export const markerVariants = cva(
  "group/marker [a]:hover:text-foreground relative flex min-h-4 w-full items-center gap-2 text-start text-sm [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "before:bg-border after:bg-border before:me-1 before:h-px before:min-w-0 before:flex-1 after:ms-1 after:h-px after:min-w-0 after:flex-1",
        border: "border-border border-b pb-2",
      },
      tone: {
        neutral: "text-muted-foreground",
        info: FEEDBACK_TONE_TEXT.info,
        success: FEEDBACK_TONE_TEXT.success,
        warning: FEEDBACK_TONE_TEXT.warning,
        destructive: FEEDBACK_TONE_TEXT.destructive,
      },
    },
    defaultVariants: {
      variant: "default",
      tone: "neutral",
    },
  },
);
