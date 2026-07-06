// Cron is considered stale when no job has run within this window. Past it the
// scheduler is likely misconfigured or stopped, which also means the queue
// worker isn't draining tasks.
export const CRON_STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export const isCronStale = (
  lastActivityAt: Date | null,
  now: Date = new Date(),
): boolean => {
  if (!lastActivityAt) return false;

  return now.getTime() - lastActivityAt.getTime() > CRON_STALE_THRESHOLD_MS;
};
