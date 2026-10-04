import { getNextCronRunDate } from "./get-next-cron-run-date";

export const CRON_OVERDUE_GRACE_MS = 15 * 60 * 1000;

export interface CronJobTiming {
  createdAt: Date;
  lastRun: Date | null;
  schedule: string;
}

export interface CronHealth {
  jobs: number;
  lastRun: Date | null;
  nextRun: Date | null;
  overdueJobs: number;
  stale: boolean;
}

const getCronJobDueAt = (job: CronJobTiming): Date | null =>
  getNextCronRunDate(job.schedule, job.lastRun ?? job.createdAt);

const isPastGrace = (dueAt: Date | null, now: Date): dueAt is Date =>
  !!dueAt && now.getTime() - dueAt.getTime() > CRON_OVERDUE_GRACE_MS;

const earliestOf = (dates: Date[]): Date | null =>
  dates.reduce<Date | null>(
    (earliest, date) => (!earliest || date < earliest ? date : earliest),
    null,
  );

export const isCronJobOverdue = (
  job: CronJobTiming,
  now: Date = new Date(),
): boolean => isPastGrace(getCronJobDueAt(job), now);

export const getCronHealth = (
  jobs: CronJobTiming[],
  now: Date = new Date(),
): CronHealth => {
  const lastRun = jobs.reduce<Date | null>(
    (latest, job) =>
      job.lastRun && (!latest || job.lastRun > latest) ? job.lastRun : latest,
    null,
  );
  const dueDates = jobs
    .map(getCronJobDueAt)
    .filter((dueAt): dueAt is Date => !!dueAt);
  const overdueSince = dueDates.filter(dueAt => isPastGrace(dueAt, now));
  const earliestOverdue = earliestOf(overdueSince);

  return {
    jobs: jobs.length,
    lastRun,
    nextRun: earliestOf(dueDates.filter(dueAt => !isPastGrace(dueAt, now))),
    overdueJobs: overdueSince.length,
    stale: !!earliestOverdue && (!lastRun || lastRun < earliestOverdue),
  };
};
