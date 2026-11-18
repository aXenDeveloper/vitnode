import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "use-intl";

import type { AccountDeletionsSummary } from "@/views/admin/views/core/users/deletions/deletions-query";

import { buttonVariants } from "@/components/ui/button";
import {
  Frame,
  FrameAction,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { debugTabPath } from "@/tanstack/admin/debug/route-search";
import { daysSince } from "@/views/admin/views/core/users/deletions/deletions-query";

import { TONE_TEXT } from "../tone";
import { FRAME_ACTION_STACKED } from "./frame-row";

type StatTone = "critical" | "neutral" | "warn";

const BAR: Record<StatTone, string> = {
  critical: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  warn: "bg-warn",
};

const Stat = ({
  children,
  label,
  note,
  tone = "neutral",
  value,
}: {
  children?: React.ReactNode;
  label: string;
  note: React.ReactNode;
  tone?: StatTone;
  value: React.ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-1 px-4 py-3">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="m-0 flex flex-col gap-1">
      <span
        className={cn(
          "text-2xl leading-tight font-semibold tracking-tight tabular-nums",
          tone === "neutral" ? "text-foreground" : TONE_TEXT[tone],
        )}
      >
        {value}
      </span>
      {children}
      <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {note}
      </span>
    </dd>
  </div>
);

const OldestRequestStat = ({
  deadlineDays,
  oldest,
}: {
  deadlineDays: number;
  oldest: null | number;
}) => {
  const t = useTranslations("admin.debug.privacy");

  if (oldest === null) {
    return <Stat label={t("oldest")} note={t("oldest_none")} value="—" />;
  }

  const tone: StatTone =
    oldest >= deadlineDays
      ? "critical"
      : oldest >= deadlineDays - 5
        ? "warn"
        : "neutral";

  return (
    <Stat
      label={t("oldest")}
      note={t("oldest_note")}
      tone={tone}
      value={
        <>
          {oldest}{" "}
          <span className="text-muted-foreground text-sm font-normal tracking-normal">
            {t("of_deadline", { deadline: deadlineDays })}
          </span>
        </>
      }
    >
      <span
        aria-hidden
        className="bg-muted block h-1 overflow-hidden rounded-full"
      >
        <span
          className={cn("block h-full rounded-full", BAR[tone])}
          style={{
            width: `${Math.min(100, (oldest / deadlineDays) * 100)}%`,
          }}
        />
      </span>
    </Stat>
  );
};

/**
 * The Debug Panel overview's view of account deletions: how close the oldest
 * open request is to GDPR's one-month limit, and what is failed or waiting.
 */
export const PrivacyRequestsFrame = ({
  summary,
}: {
  summary: AccountDeletionsSummary;
}) => {
  const t = useTranslations("admin.debug.privacy");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const since = (date: string) => format.relativeTime(new Date(date), now);
  const scheduledNote =
    summary.overdue > 0
      ? t("overdue_note", { count: summary.overdue })
      : summary.nextScheduledAt
        ? t("next_note", { when: since(summary.nextScheduledAt) })
        : t("none");

  return (
    <Frame render={<section aria-labelledby="privacy-requests-title" />}>
      <FrameHeader>
        <FrameTitle id="privacy-requests-title" render={<h2 />}>
          {t("title")}
        </FrameTitle>
        <FrameDescription>{t("desc")}</FrameDescription>
        <FrameAction className={FRAME_ACTION_STACKED}>
          <Link
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            resetScroll={false}
            to={debugTabPath("deletions")}
          >
            {t("open")}
            <ChevronRightIcon aria-hidden />
          </Link>
        </FrameAction>
      </FrameHeader>
      <FramePanel>
        <dl className="[&>*]:border-border m-0 grid grid-cols-2 lg:grid-cols-4 lg:[&>*:not(:last-child)]:border-r max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r">
          <OldestRequestStat
            deadlineDays={summary.deadlineDays}
            oldest={
              summary.oldestOpenAt
                ? daysSince(summary.oldestOpenAt, now.getTime())
                : null
            }
          />
          <Stat
            label={t("failed")}
            note={summary.failed > 0 ? t("failed_note") : t("none")}
            tone={summary.failed > 0 ? "critical" : "neutral"}
            value={summary.failed}
          />
          <Stat
            label={t("scheduled")}
            note={scheduledNote}
            tone={summary.overdue > 0 ? "warn" : "neutral"}
            value={summary.pending}
          />
          <Stat
            label={t("erased")}
            note={
              summary.job.lastRun
                ? t("job_ran", { when: since(summary.job.lastRun) })
                : t("job_never")
            }
            value={summary.erasedLast30Days}
          />
        </dl>
      </FramePanel>
    </Frame>
  );
};
