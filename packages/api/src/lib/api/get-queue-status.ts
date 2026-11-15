interface GetQueueStatusArgs {
  // `true` when a cron adapter is configured, i.e. the worker that drains the
  // queue is running.
  cronActive: boolean;
  // `true` when the cron scheduler looks stopped (no job ran recently).
  cronStale: boolean;
  // `true` when at least one queue task handler is registered.
  hasTaskHandlers: boolean;
}

// The queue is drained by cron, so it can only be active when a cron adapter is
// configured and its scheduler is running. With cron off the queue is off too.
export const getQueueStatus = ({
  cronActive,
  cronStale,
  hasTaskHandlers,
}: GetQueueStatusArgs): { active: boolean; cronStale: boolean } => ({
  active: hasTaskHandlers && cronActive && !cronStale,
  cronStale: hasTaskHandlers && cronActive && cronStale,
});
