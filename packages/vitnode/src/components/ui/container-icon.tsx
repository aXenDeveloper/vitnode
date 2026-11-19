import { parseContentContainerIcon } from "@vitnode/api/content/containers/icon";
import { cn } from "cn";

import { EmojiIcon } from "./emoji-icon";

/**
 * Renders a stored container icon (`field.icon()`): an emoji, a Lucide icon or
 * an uploaded image, at icon size. Renders `fallback` for an empty or invalid
 * value. Decorative - pair it with visible text.
 */
export const ContainerIcon = ({
  className,
  fallback = null,
  value,
}: {
  className?: string;
  fallback?: null | React.ReactElement;
  value: null | string | undefined;
}): null | React.ReactElement => {
  const parsed = parseContentContainerIcon(value);
  if (!parsed) return fallback;

  if (parsed.type === "image") {
    return (
      <img
        alt=""
        aria-hidden
        className={cn("size-4 shrink-0 rounded-sm object-cover", className)}
        decoding="async"
        loading="lazy"
        src={parsed.value}
      />
    );
  }

  return <EmojiIcon className={className} value={parsed} />;
};
