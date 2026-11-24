import type { ContentTarget } from "@vitnode/api/content/target";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { ShortNumber } from "@/components/ui/short-number";
import { Skeleton } from "@/components/ui/skeleton";

import type { ReactionsCatalog, ReactionSummary } from "./query";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import {
  reactionsCatalogQueryOptions,
  reactionSummaryQueryOptions,
} from "./query";

/**
 * The points of one item's reactions: each reaction's count times its points
 * from the catalog (AdminCP → Reactions). Disabled reactions are not in the
 * summary, so they add nothing. Universal.
 */
export const reactionPoints = (
  summary: Pick<ReactionSummary, "counts">,
  catalog: Pick<ReactionsCatalog, "items">,
): number => {
  const pointsOf = new Map(catalog.items.map(item => [item.code, item.points]));

  return summary.counts.reduce(
    (sum, { code, count }) => sum + count * (pointsOf.get(code) ?? 0),
    0,
  );
};

const PointsBadge = ({
  className,
  value,
}: {
  className?: string;
  value: number;
}) => {
  const t = useTranslations("core.reactions.points");

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

const ReactionPointsInner = ({
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
        value={reactionPoints(summary.data, catalog.data)}
      />
    );
  }
  if (initial !== undefined) {
    return <PointsBadge className={className} value={initial} />;
  }

  return <Skeleton className={cn("h-7 w-20 rounded-full", className)} />;
};

/**
 * One item's points from reactions as a tinted pill, such as "+12 points":
 * green above zero, red below, gray at zero, the sign always written. Render
 * it next to the item's `ReactionBar`: it reads the summary and catalog the
 * bar loads (it never fetches them itself) and follows the bar's live counts.
 * Until they load it shows `initial` - a number the server ranked by - or a
 * placeholder of the same size. Loads its own messages.
 *
 * @example
 * ```tsx
 * import { ReactionBar, ReactionPoints } from "@vitnode/core/tanstack/reactions";
 *
 * <ReactionPoints target={target} />
 * <ReactionBar target={target} />
 * ```
 */
export const ReactionPoints = (props: {
  className?: string;
  /** The server's points, shown until the bar's live data is in. */
  initial?: number;
  target: ContentTarget;
}) => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={["core.reactions"]}>
      <ReactionPointsInner {...props} />
    </RouteMessages>
  </React.Suspense>
);
