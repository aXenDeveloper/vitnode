// No "use client" here on purpose: this module is only reached from
// `edit-action`, which is already a client entry. Declaring it again would make
// this a nested client entry, and `next/dynamic` cannot resolve one from inside a
// published package - the dialog spins forever.
import { CircleCheckIcon, CircleDashedIcon, FileClockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

/**
 * Where one locale stands.
 *
 * Three states, and deliberately only three. There is no `Outdated`: the honest
 * definition of it would be "the source language changed after this translation
 * did", and comparing two `updatedAt` timestamps does not mean that - a typo fix
 * in English would mark every translation stale, while a rewrite made a second
 * before a translation was saved would not. A badge that is wrong half the time is
 * worse than no badge. `Fallback` is a *public read* state and belongs in Stage 5C,
 * where there is a public read to describe.
 */
export type TranslationState = "draft" | "missing" | "published";

export const translationStateOf = ({
  present,
  status,
}: {
  present: boolean;
  /** Absent for a content type without publication - then present means done. */
  status?: string;
}): TranslationState => {
  if (!present) return "missing";
  if (status === undefined) return "published";

  return status === "published" ? "published" : "draft";
};

const ICONS = {
  draft: FileClockIcon,
  missing: CircleDashedIcon,
  published: CircleCheckIcon,
} as const;

export const TranslationStatusBadge = ({
  state,
}: {
  state: TranslationState;
}) => {
  const t = useTranslations("core.content.translations.states");
  const Icon = ICONS[state];

  return (
    <Badge
      variant={
        state === "published"
          ? "default"
          : state === "draft"
            ? "secondary"
            : "outline"
      }
    >
      <Icon aria-hidden />
      {t(state)}
    </Badge>
  );
};
