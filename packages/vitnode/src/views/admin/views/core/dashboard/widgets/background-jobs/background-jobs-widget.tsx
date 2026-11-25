import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRightIcon,
  CircleXIcon,
  CogIcon,
  RotateCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipGroup, TooltipWithContent } from "@/components/ui/tooltip";
import { useAdminIdentity } from "@/tanstack/admin/identity";
import { AdminLink } from "@/views/admin/layouts/admin-link";

import { cronHeartbeatQueryOptions } from "./heartbeat-query";

const ADMIN_UNFINISHED_JOBS_HREF = "/admin/core/debug/queue";
const ADMIN_CRON_HREF = "/admin/core/debug/cron";

const SLOT_TONE = {
  missed: "bg-warn",
  none: "bg-muted",
  ran: "bg-success/70",
} as const;

const LINK_CLASS =
  "text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline";

const BackgroundJobsSkeleton = () => (
  <div aria-hidden="true" className="flex flex-1 flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-6 w-full" />
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-14" key={index} />
      ))}
    </div>
    <Skeleton className="h-4 w-2/3" />
  </div>
);

export const BackgroundJobsWidget = () => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  const tGlobal = useTranslations("core.global");
  const format = useFormatter();
  const adminUserId = useAdminIdentity();
  const query = useQuery(cronHeartbeatQueryOptions({ adminUserId }));

  if (query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-1 flex-col" role="status">
        <span className="sr-only">{tGlobal("loading")}</span>
        <BackgroundJobsSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Empty className="flex-1 p-0" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CogIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const { active, queue, secretRejected, slots } = query.data;
  const missed = slots.filter(slot => slot.state === "missed").length;
  const hasHistory = slots.some(slot => slot.state !== "none");
  const problem = !active
    ? t("inactive")
    : secretRejected
      ? t("secret_rejected")
      : null;
  const slotTime = (slot: string) =>
    format.dateTime(new Date(slot), { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-1 flex-col gap-4">
      {problem === null ? null : (
        <p className="text-warn flex items-start gap-2 text-sm leading-relaxed">
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="text-pretty">{problem}</span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">{t("strip")}</span>
          <span
            className={cn(
              "tabular-nums",
              !hasHistory
                ? "text-muted-foreground"
                : missed > 0
                  ? "text-warn"
                  : "text-success",
            )}
          >
            {!hasHistory
              ? t("no_history")
              : missed > 0
                ? t("missed", { count: missed })
                : t("no_gaps")}
          </span>
        </div>
        <TooltipGroup>
          <div
            aria-label={t("strip_label")}
            className="flex h-6 gap-0.5"
            role="group"
          >
            {slots.map(slot => {
              const label = t(`slot.${slot.state}`, {
                time: slotTime(slot.slot),
              });

              return (
                <TooltipWithContent key={slot.slot} text={label}>
                  <span
                    aria-label={label}
                    className={cn(
                      "min-w-0 flex-1 rounded-xs",
                      SLOT_TONE[slot.state],
                    )}
                    role="img"
                  />
                </TooltipWithContent>
              );
            })}
          </div>
        </TooltipGroup>
      </div>

      {queue === null ? null : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t("waiting"), value: queue.pending },
              { label: t("running"), value: queue.processing },
              {
                label: t("failed"),
                tone: queue.failed > 0 ? "text-destructive" : undefined,
                value: queue.failed,
              },
              { label: t("done"), value: queue.completedLastDay },
            ].map(stat => (
              <div
                className="bg-muted/50 flex min-w-0 flex-col gap-0.5 rounded-md px-3 py-2"
                key={stat.label}
              >
                <dt className="text-muted-foreground text-xs leading-snug text-pretty">
                  {stat.label}
                </dt>
                <dd
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    stat.tone,
                  )}
                >
                  {format.number(stat.value)}
                </dd>
              </div>
            ))}
          </dl>

          {queue.failedJobs.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {queue.failedJobs.map(job => (
                <li className="flex items-start gap-2 text-sm" key={job.id}>
                  <CircleXIcon
                    aria-hidden="true"
                    className="text-destructive mt-0.5 size-4 shrink-0"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                      <span className="font-mono font-medium">{job.name}</span>
                      <span className="text-muted-foreground">
                        <DateFormat date={job.createdAt} />
                      </span>
                    </span>
                    {job.lastError ? (
                      <span
                        className="text-muted-foreground truncate text-xs"
                        title={job.lastError}
                      >
                        {job.lastError}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {queue === null ? null : (
          <AdminLink className={LINK_CLASS} href={ADMIN_UNFINISHED_JOBS_HREF}>
            {t("unfinished_jobs")}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </AdminLink>
        )}
        <AdminLink className={LINK_CLASS} href={ADMIN_CRON_HREF}>
          {t("cron")}
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </AdminLink>
      </div>
    </div>
  );
};
