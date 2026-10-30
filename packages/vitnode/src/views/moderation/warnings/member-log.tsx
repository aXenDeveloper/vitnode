import type { LucideIcon } from "lucide-react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  HistoryIcon,
  ShieldAlertIcon,
  ShieldOffIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { ModcpMemberLogEntry } from "./warnings-api";

import { PersonName } from "../modcp/report-tone";
import { memberLogQueryOptions } from "./warnings-api";

const ICONS: Record<string, LucideIcon> = {
  "sanction.applied": ShieldAlertIcon,
  "sanction.revoked": ShieldOffIcon,
  "warning.issued": TriangleAlertIcon,
  "warning.revoked": Undo2Icon,
};

const numberOf = (value: unknown): null | number =>
  typeof value === "number" ? value : null;

const EntryText = ({
  entry,
}: {
  entry: ModcpMemberLogEntry;
}): React.ReactNode => {
  const t = useTranslations("core.moderation.warn.log");
  const format = useFormatter();
  const { metadata } = entry;
  const actor = () =>
    entry.actor ? (
      <PersonName link person={entry.actor} />
    ) : (
      (entry.actorName ?? t("someone"))
    );
  const points = numberOf(metadata.points) ?? 0;

  switch (entry.action) {
    case "sanction.applied": {
      const endsAt =
        typeof metadata.endsAt === "string" ? new Date(metadata.endsAt) : null;
      const values = {
        actor,
        threshold: numberOf(metadata.thresholdPoints) ?? 0,
      };

      return endsAt
        ? t.rich("sanction_applied_until", {
            ...values,
            endsAt: format.dateTime(endsAt, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })
        : t.rich("sanction_applied_indefinite", values);
    }
    case "sanction.revoked":
      return t.rich("sanction_revoked", { actor });
    case "warning.issued":
      return t.rich("warning_issued", {
        actor,
        after: numberOf(metadata.pointsAfter) ?? points,
        before: numberOf(metadata.pointsBefore) ?? 0,
        points,
      });
    case "warning.revoked":
      return t.rich("warning_revoked", { actor, points });
    default:
      return t.rich("other", { action: entry.action, actor });
  }
};

const EntryDetails = ({ entry }: { entry: ModcpMemberLogEntry }) => {
  const t = useTranslations("core.moderation.warn.log");
  const { metadata } = entry;
  const reportId = numberOf(metadata.reportId);
  const details = [
    metadata.pointsOverridden === true
      ? t("points_overridden", {
          points: numberOf(metadata.defaultPoints) ?? 0,
        })
      : null,
    metadata.expirationOverridden === true ? t("expiration_overridden") : null,
  ].filter((detail): detail is string => detail !== null);

  if (details.length === 0 && reportId === null) return null;

  return (
    <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {details.map(detail => (
        <span key={detail}>{detail}</span>
      ))}
      {reportId === null ? null : (
        <Link
          className="text-primary underline-offset-4 hover:underline"
          to={`/modcp/reports/${reportId}`}
        >
          {t("report", { id: reportId })}
        </Link>
      )}
    </p>
  );
};

const PendingRows = () => (
  <ul aria-hidden="true" className="flex flex-col gap-3">
    {[0, 1, 2].map(row => (
      <li className="flex items-start gap-3" key={row}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-24" />
        </div>
      </li>
    ))}
  </ul>
);

/**
 * The member's moderation log: who warned them, revoked a warning, or applied
 * and lifted a suspension, from the central activity log. Never shows staff
 * notes. Only for moderators with `can_view`.
 */
export const MemberLog = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.moderation.warn.log");
  const titleId = React.useId();
  const query = useInfiniteQuery(memberLogQueryOptions(userId));
  const entries = query.data?.pages.flatMap(page => page.edges) ?? [];

  return (
    <section
      aria-busy={query.isPending || query.isFetchingNextPage}
      aria-labelledby={titleId}
      className="flex flex-col gap-3"
    >
      <h2
        className="text-foreground text-lg font-semibold text-balance"
        id={titleId}
      >
        {t("title")}
      </h2>

      <div className="bg-card ring-foreground/5 flex flex-col gap-4 rounded-xl p-4 shadow-xs ring-1 dark:shadow-none">
        {query.isPending ? (
          <>
            <span className="sr-only" role="status">
              {t("loading")}
            </span>
            <PendingRows />
          </>
        ) : query.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {t("error")}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm leading-relaxed">
            <HistoryIcon aria-hidden="true" className="size-4 shrink-0" />
            {t("empty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {entries.map(entry => {
              const Icon = ICONS[entry.action] ?? HistoryIcon;

              return (
                <li className="flex items-start gap-3" key={entry.id}>
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-foreground text-sm leading-relaxed text-pretty">
                      <EntryText entry={entry} />
                    </p>
                    <EntryDetails entry={entry} />
                    <p className="text-muted-foreground text-xs">
                      <DateFormat date={entry.createdAt} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {query.hasNextPage ? (
          <Button
            className="self-start"
            isLoading={query.isFetchingNextPage}
            onClick={() => {
              void query.fetchNextPage();
            }}
            size="sm"
            variant="outline"
          >
            <ChevronDownIcon aria-hidden="true" />
            {t("load_more")}
          </Button>
        ) : null}
      </div>
    </section>
  );
};
