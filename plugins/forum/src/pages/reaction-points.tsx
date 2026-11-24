import type { ContentTarget } from "@vitnode/core/content";
import type {
  ReactionsCatalog,
  ReactionSummary,
} from "@vitnode/core/tanstack/reactions";

import { useQuery } from "@tanstack/react-query";
import { FEEDBACK_TONE_TEXT } from "@vitnode/core/components/ui/feedback-tone";
import { ShortNumber } from "@vitnode/core/components/ui/short-number";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import {
  reactionsCatalogQueryOptions,
  reactionSummaryQueryOptions,
} from "@vitnode/core/tanstack/reactions";
import { cn } from "cn";
import { useTranslations } from "use-intl";

/**
 * Points from the reactions on screen: each reaction's count times its points
 * from the catalog - the same sum the server ranks by.
 */
export const pointsFromSummary = (
  summary: Pick<ReactionSummary, "counts">,
  catalog: Pick<ReactionsCatalog, "items">,
): number => {
  const pointsOf = new Map(catalog.items.map(item => [item.code, item.points]));

  return summary.counts.reduce(
    (sum, { code, count }) => sum + count * (pointsOf.get(code) ?? 0),
    0,
  );
};

export const PointsBadge = ({
  className,
  value,
}: {
  className?: string;
  value: number;
}) => {
  const t = useTranslations("@vitnode/forum.forums.points");

  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
        value > 0 && [
          FEEDBACK_TONE_TEXT.success,
          "bg-success/10 dark:bg-success/20",
        ],
        value < 0 && [
          FEEDBACK_TONE_TEXT.destructive,
          "bg-destructive/10 dark:bg-destructive/20",
        ],
        value === 0 && "bg-muted text-muted-foreground",
        className,
      )}
      title={t("hint")}
    >
      <ShortNumber
        className="font-semibold tabular-nums"
        formatOptions={{ signDisplay: "exceptZero" }}
        value={value}
      />
      <span className="opacity-80">{t("unit", { count: value })}</span>
    </span>
  );
};

/**
 * The points of one topic or comment, live. Render it next to the item's
 * `ReactionBar`: it reads the summary and catalog the bar loads (it never
 * fetches them itself) and follows the bar's live counts. Until they load it
 * shows `initial`, the server's number, or a placeholder of the same size.
 */
export const ReactionPoints = ({
  className,
  initial,
  target,
}: {
  className?: string;
  initial?: number;
  target: ContentTarget;
}) => {
  const session = useSessionQuery();
  const viewerId = session.data?.user?.id ?? null;
  // Read-only: the `ReactionBar` next to it fetches both, after hydration. A
  // fetch started here could land before the bar hydrates and make it render
  // something the server did not.
  const summary = useQuery({
    ...reactionSummaryQueryOptions(target, viewerId),
    enabled: false,
  });
  const catalog = useQuery({
    ...reactionsCatalogQueryOptions(viewerId),
    enabled: false,
  });

  if (summary.data && catalog.data) {
    return (
      <PointsBadge
        className={className}
        value={pointsFromSummary(summary.data, catalog.data)}
      />
    );
  }

  if (initial !== undefined) {
    return <PointsBadge className={className} value={initial} />;
  }

  return <Skeleton className={cn("h-7 w-20 rounded-full", className)} />;
};
