import { parseEmojiIcon } from "@vitnode/api/lib/emoji-icon";
import { cn } from "cn";
import { SmileIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ReactionLook } from "@/tanstack/reactions/reaction-icon";

import { popReactionIcon } from "@/tanstack/reactions/reaction-flight";
import { ReactionIcon } from "@/tanstack/reactions/reaction-icon";

import type { ReactionFormValues } from "./reaction-form";

export const reactionLookOf = (values: ReactionFormValues): ReactionLook => {
  if (values.source === "image") {
    return { icon: null, image: values.image?.image ?? null, kind: "image" };
  }
  const picked = parseEmojiIcon(values.symbol);

  return {
    icon: picked ? values.symbol : null,
    image: null,
    kind: picked?.type ?? "emoji",
  };
};

export const hasReactionLook = (values: ReactionFormValues) => {
  const look = reactionLookOf(values);

  return look.kind === "image" ? look.image !== null : !!look.icon;
};

const SAMPLE_COUNT = 12;

export const ReactionLivePreview = ({
  title,
  values,
}: {
  title: string;
  values: ReactionFormValues;
}) => {
  const t = useTranslations("admin.reactions.form");
  const glyphRef = React.useRef<HTMLSpanElement>(null);
  const look = reactionLookOf(values);
  const visible = hasReactionLook(values);
  const lookKey = `${look.kind}:${look.icon ?? ""}:${look.image?.url ?? ""}`;
  const shownKey = React.useRef(lookKey);

  React.useEffect(() => {
    if (shownKey.current === lookKey) return;
    shownKey.current = lookKey;
    if (visible) popReactionIcon(glyphRef.current);
  }, [lookKey, visible]);

  const glyph = (className: string) =>
    visible ? (
      <ReactionIcon className={className} reaction={look} />
    ) : (
      <SmileIcon aria-hidden="true" className={cn(className, "opacity-30")} />
    );

  return (
    <figure className="flex flex-col items-center gap-3 px-3 pt-2 pb-4 text-center">
      <span className="bg-background flex size-16 items-center justify-center rounded-2xl border shadow-xs">
        <span className="flex will-change-transform" ref={glyphRef}>
          {glyph("size-8 text-3xl")}
        </span>
      </span>
      <figcaption className="max-w-full truncate text-sm font-semibold">
        <span className="sr-only">{t("preview")}: </span>
        {title}
      </figcaption>
      <span
        aria-hidden="true"
        className={cn(
          "bg-background text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-medium tabular-nums",
          !values.enabled && "opacity-60",
        )}
      >
        {glyph("size-4")}
        {SAMPLE_COUNT}
      </span>
    </figure>
  );
};
