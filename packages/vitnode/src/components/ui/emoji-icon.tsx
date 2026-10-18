import { cn } from "cn";

import type { EmojiIconValue } from "@/lib/emoji-icon";

import { DynamicIcon } from "./dynamic-icon";

/**
 * Renders an emoji-or-icon value at icon size: the emoji as text, or the Lucide
 * icon via {@link DynamicIcon}. Renders nothing for an empty value. Decorative:
 * the emoji is `aria-hidden`, and the icon is hidden by Lucide's default.
 */
export const EmojiIcon = ({
  className,
  value,
}: {
  className?: string;
  value: EmojiIconValue | null | undefined;
}) => {
  if (!value) return null;

  if (value.type === "emoji") {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center leading-none",
          className,
        )}
      >
        {value.value}
      </span>
    );
  }

  return (
    <DynamicIcon
      className={cn("inline-block size-4 shrink-0", className)}
      name={value.value}
    />
  );
};
