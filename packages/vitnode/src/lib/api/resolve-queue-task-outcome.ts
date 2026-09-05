import { getQueueBackoffDate } from "./get-queue-backoff-date";

export type QueueTaskStatus = "completed" | "failed" | "pending" | "processing";

export interface QueueTaskOutcome {
  availableAt?: Date;
  completedAt?: Date;
  lastError: null | string;
  status: QueueTaskStatus;
}

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
