import type { AdminCronSummary } from "./summary-query";

export type SchedulerProblem = "inactive" | "secret_rejected" | "stale";

export type SchedulerStatus =
  | "not_set_up"
  | "running"
  | "stopped"
  | "waiting"
  | "wrong_secret";

export type BackgroundJobsVerdict =
  | "down"
  | "failed"
  | "first_run"
  | "idle"
  | "running";

export const schedulerProblemOf = (
  summary: AdminCronSummary,
): null | SchedulerProblem => {
  if (!summary.active) return "inactive";
  if (summary.secretRejected) return "secret_rejected";
  if (summary.scheduler.stale) return "stale";

  return null;
};

const STATUS_BY_PROBLEM: Record<SchedulerProblem, SchedulerStatus> = {
  inactive: "not_set_up",
  secret_rejected: "wrong_secret",
  stale: "stopped",
};

export const schedulerStatusOf = (
  summary: AdminCronSummary,
): SchedulerStatus => {
  const problem = schedulerProblemOf(summary);
  if (problem !== null) return STATUS_BY_PROBLEM[problem];

  return summary.scheduler.lastRun === null ? "waiting" : "running";
};

export const backgroundJobsVerdictOf = (
  summary: AdminCronSummary,
): BackgroundJobsVerdict => {
  if (schedulerProblemOf(summary) !== null) return "down";
  if (summary.queue !== null && summary.queue.failed > 0) return "failed";
  if (summary.queue !== null && summary.queue.processing > 0) {
    return "running";
  }
  if (summary.scheduler.lastRun === null) return "first_run";

  return "idle";
};

export const elapsedPartsOf = (from: Date, now: Date) => {
  const total = Math.max(
    0,
    Math.floor((now.getTime() - from.getTime()) / 1000),
  );

  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
};
