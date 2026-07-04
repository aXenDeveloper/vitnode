import { getQueueBackoffDate } from "./get-queue-backoff-date";

export type QueueTaskStatus = "completed" | "failed" | "pending" | "processing";

export interface QueueTaskOutcome {
  availableAt?: Date;
  completedAt?: Date;
  lastError: null | string;
  status: QueueTaskStatus;
}

/**
 * Decide the next state of a task after its handler ran. `attempts` is the
 * count including the run that just happened. Without an error the task is
 * `completed`; with one it is retried (`pending` with a backoff `availableAt`)
 * until `maxAttempts` is reached, after which it is `failed`.
 */
export const resolveQueueTaskOutcome = ({
  attempts,
  maxAttempts,
  error,
  now = new Date(),
}: {
  attempts: number;
  error?: null | string;
  maxAttempts: number;
  now?: Date;
}): QueueTaskOutcome => {
  if (!error) {
    return { status: "completed", completedAt: now, lastError: null };
  }

  if (attempts < maxAttempts) {
    return {
      status: "pending",
      availableAt: getQueueBackoffDate(attempts, now),
      lastError: error,
    };
  }

  return { status: "failed", completedAt: now, lastError: error };
};
