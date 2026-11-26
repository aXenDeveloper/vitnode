import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleOffIcon,
  CircleXIcon,
  ClockIcon,
  CogIcon,
  LoaderCircleIcon,
  RotateCwIcon,
} from "lucide-react";
import { useNow, useTranslations } from "use-intl";

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
import { useAdminIdentity } from "@/tanstack/admin/identity";
import { AdminLink } from "@/views/admin/layouts/admin-link";

import type { AdminCronSummary } from "./summary-query";

import {
  type BackgroundJobsVerdict,
  backgroundJobsVerdictOf,
  elapsedPartsOf,
  schedulerProblemOf,
  type SchedulerStatus,
  schedulerStatusOf,
} from "./background-jobs-status";
import { cronSummaryQueryOptions } from "./summary-query";

const ADMIN_UNFINISHED_JOBS_HREF = "/admin/core/debug/queue";
const ADMIN_CRON_HREF = "/admin/core/debug/cron";

const LINK_CLASS =
  "text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline";

const MORE_LINK_CLASS =
  "text-muted-foreground w-fit py-1 text-xs underline-offset-4 hover:underline";

const VERDICT_ICON: Record<BackgroundJobsVerdict, React.ElementType> = {
  down: CircleOffIcon,
  failed: CircleXIcon,
  first_run: ClockIcon,
  idle: CircleCheckIcon,
  running: LoaderCircleIcon,
};

const VERDICT_TONE: Record<BackgroundJobsVerdict, string> = {
  down: "text-destructive",
  failed: "text-destructive",
  first_run: "text-muted-foreground",
  idle: "text-success",
  running: "text-primary motion-safe:animate-spin",
};

const STATUS_TONE: Record<SchedulerStatus, { dot: string; text: string }> = {
  not_set_up: { dot: "bg-destructive", text: "text-destructive" },
  running: { dot: "bg-success", text: "text-success" },
  stopped: { dot: "bg-destructive", text: "text-destructive" },
  waiting: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  wrong_secret: { dot: "bg-destructive", text: "text-destructive" },
};

const BackgroundJobsSkeleton = () => (
  <div aria-hidden="true" className="flex flex-1 flex-col gap-4">
    <div className="flex items-start gap-3">
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    </div>
    <div className="flex flex-col gap-2 border-t pt-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: 2 }, (_, index) => (
        <Skeleton className="h-5 w-full" key={index} />
      ))}
    </div>
    <Skeleton className="h-4 w-2/3" />
  </div>
);

const Elapsed = ({ startedAt }: { startedAt: string }) => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs.elapsed");
  const now = useNow({ updateInterval: 1000 });
  const parts = elapsedPartsOf(new Date(startedAt), now);

  return (
    <span
      className="text-muted-foreground w-16 shrink-0 text-end text-xs tabular-nums"
      suppressHydrationWarning
    >
      {parts.hours > 0
        ? t("hours", parts)
        : parts.minutes > 0
          ? t("minutes", parts)
          : t("seconds", parts)}
    </span>
  );
};

const MoreLink = ({ count }: { count: number }) => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  if (count <= 0) return null;

  return (
    <AdminLink className={MORE_LINK_CLASS} href={ADMIN_UNFINISHED_JOBS_HREF}>
      {t("more", { count })}
    </AdminLink>
  );
};

const Verdict = ({ summary }: { summary: AdminCronSummary }) => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  const verdict = backgroundJobsVerdictOf(summary);
  const problem = schedulerProblemOf(summary);
  const { queue } = summary;
  const Icon = VERDICT_ICON[verdict];
  const pending = queue?.pending ?? 0;
  const lastRun = summary.scheduler.lastRun;

  const title =
    verdict === "down"
      ? pending > 0
        ? t("verdict.down.title_stuck", { count: pending })
        : t("verdict.down.title")
      : verdict === "failed"
        ? t("verdict.failed.title", { count: queue?.failed ?? 0 })
        : verdict === "running"
          ? t("verdict.running.title", { count: queue?.processing ?? 0 })
          : verdict === "first_run"
            ? t("verdict.first_run.title")
            : t("verdict.idle.title");

  const desc =
    problem === "stale"
      ? lastRun === null
        ? t("problem.stale_never")
        : t.rich("problem.stale", {
            date: () => <DateFormat date={lastRun} />,
          })
      : problem !== null
        ? t(`problem.${problem}`)
        : verdict === "failed" && queue !== null
          ? queue.processing > 0
            ? t("verdict.failed.desc_busy", {
                running: queue.processing,
                waiting: queue.pending,
              })
            : t("verdict.failed.desc", { count: queue.failed })
          : verdict === "running" && queue !== null
            ? t("verdict.running.desc", {
                done: queue.completedLastDay,
                waiting: queue.pending,
              })
            : verdict === "first_run"
              ? t("verdict.first_run.desc")
              : queue === null
                ? t("verdict.idle.desc_no_queue")
                : t("verdict.idle.desc", { count: queue.completedLastDay });

  return (
    <div className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", VERDICT_TONE[verdict])}
      />
      <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
        <p className="font-medium text-balance">{title}</p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {desc}
        </p>
      </div>
    </div>
  );
};

const RunningJobs = ({
  queue,
}: {
  queue: NonNullable<AdminCronSummary["queue"]>;
}) => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  if (queue.runningJobs.length === 0) return null;

  return (
    <section
      aria-labelledby="background-jobs-running"
      className="flex flex-col gap-2 border-t pt-3"
    >
      <h3
        className="text-muted-foreground text-xs font-medium"
        id="background-jobs-running"
      >
        {t("running_now")}
      </h3>
      <ul className="flex flex-col gap-2">
        {queue.runningJobs.map(job => (
          <li className="flex items-center gap-2 text-sm" key={job.id}>
            <LoaderCircleIcon
              aria-hidden="true"
              className="text-primary size-4 shrink-0 motion-safe:animate-spin"
            />
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={job.name}
            >
              {job.name}
            </span>
            {job.attempts > 1 ? (
              <span className="text-warn shrink-0 text-xs tabular-nums">
                <span aria-hidden="true">
                  {t("attempt", {
                    attempt: job.attempts,
                    max: job.maxAttempts,
                  })}
                </span>
                <span className="sr-only">
                  {t("attempt_label", {
                    attempt: job.attempts,
                    max: job.maxAttempts,
                  })}
                </span>
              </span>
            ) : null}
            <Elapsed startedAt={job.startedAt} />
          </li>
        ))}
      </ul>
      <MoreLink count={queue.processing - queue.runningJobs.length} />
    </section>
  );
};

const FailedJobs = ({
  queue,
}: {
  queue: NonNullable<AdminCronSummary["queue"]>;
}) => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  if (queue.failedJobs.length === 0) return null;

  return (
    <section
      aria-labelledby="background-jobs-failed"
      className="flex flex-col gap-2 border-t pt-3"
    >
      <h3
        className="text-muted-foreground text-xs font-medium"
        id="background-jobs-failed"
      >
        {t("latest_failures")}
      </h3>
      <ul className="flex flex-col gap-3">
        {queue.failedJobs.map(job => (
          <li className="flex items-start gap-2 text-sm" key={job.id}>
            <CircleXIcon
              aria-hidden="true"
              className="text-destructive mt-0.5 size-4 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs font-medium"
                  title={job.name}
                >
                  {job.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  <DateFormat date={job.failedAt} />
                </span>
              </span>
              <span
                className="text-muted-foreground line-clamp-2 text-xs leading-relaxed"
                title={job.lastError ?? undefined}
              >
                {job.lastError ?? t("no_error")}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <MoreLink count={queue.failed - queue.failedJobs.length} />
    </section>
  );
};

const SchedulerLine = ({ summary }: { summary: AdminCronSummary }) => {
  const t = useTranslations(
    "admin.dashboard.widgets.background-jobs.scheduler",
  );
  const status = schedulerStatusOf(summary);
  const tone = STATUS_TONE[status];
  const { lastRun, nextRun, overdueTasks } = summary.scheduler;
  const healthy = status === "running" || status === "waiting";

  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t pt-3 text-sm">
      <span className="text-foreground inline-flex items-center gap-1.5 font-medium">
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", tone.dot)}
        />
        {t("label")}
        <span aria-hidden="true">·</span>
        <span className={tone.text}>{t(`status.${status}`)}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {lastRun === null
          ? t("never_ran")
          : t.rich("last_run", { date: () => <DateFormat date={lastRun} /> })}
      </span>
      {healthy && nextRun !== null ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {t.rich("next_run", { date: () => <DateFormat date={nextRun} /> })}
          </span>
        </>
      ) : null}
      {overdueTasks > 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-warn">
            {t("overdue", { count: overdueTasks })}
          </span>
        </>
      ) : null}
    </p>
  );
};

export const BackgroundJobsWidget = () => {
  const t = useTranslations("admin.dashboard.widgets.background-jobs");
  const tGlobal = useTranslations("core.global");
  const adminUserId = useAdminIdentity();
  const query = useQuery(cronSummaryQueryOptions({ adminUserId }));

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

  const summary = query.data;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Verdict summary={summary} />
      {summary.queue === null ? null : (
        <>
          <RunningJobs queue={summary.queue} />
          <FailedJobs queue={summary.queue} />
        </>
      )}
      <SchedulerLine summary={summary} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {summary.queue === null ? null : (
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
