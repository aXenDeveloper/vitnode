import { parseEmojiIcon } from "@vitnode/api/lib/emoji-icon";
import { cn } from "cn";

import { EmojiIcon } from "@/components/ui/emoji-icon";

/** What a reaction looks like, as the catalog sends it. */
export interface ReactionLook {
  icon: null | string;
  image: null | {
    animated: boolean;
    height: null | number;
    posterUrl: null | string;
    url: string;
    width: null | number;
  };
  kind: "emoji" | "icon" | "image";
}

/**
 * One reaction's emoji, Lucide icon or uploaded image at icon size.
 * Decorative: the button around it carries the label. An animated image shows
 * its still first frame to people who prefer reduced motion. Universal.
 */
export const ReactionIcon = ({
  className,
  reaction,
}: {
  className?: string;
  reaction: ReactionLook;
}) => {
  if (reaction.kind === "image" && reaction.image) {
    const { animated, height, posterUrl, url, width } = reaction.image;
    const img = (
      <img
        alt=""
        aria-hidden="true"
        className={cn("size-4 shrink-0 object-contain", className)}
        decoding="async"
        height={height ?? 16}
        loading="lazy"
        src={url}
        width={width ?? 16}
      />
    );

    return animated && posterUrl ? (
      <picture className="contents">
        <source media="(prefers-reduced-motion: reduce)" srcSet={posterUrl} />
        {img}
      </picture>
    ) : (
      img
    );
  }

  return (
    <EmojiIcon
      className={cn("text-base", className)}
      value={parseEmojiIcon(reaction.icon ?? undefined)}
    />
  );
};
