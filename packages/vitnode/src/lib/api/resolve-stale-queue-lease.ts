import type { QueueTaskOutcome } from "./resolve-queue-task-outcome";

/**
 * How long a claimed task may stay `processing` before another tick may take it
 * back.
 *
 * The queue's claim is a lease, not a lock: `processQueueTasks` flips rows to
 * `processing` and stamps `reservedAt`, then runs the handlers. If the process
 * dies in between - a deploy, an OOM kill, a container reschedule - nothing
 * ever writes the finishing update, and the row is invisible to every later
 * tick, which only ever selects `pending`. Without recovery that task is lost
 * permanently.
 *
 * Fifteen minutes rather than the cron's own minute: a batch of 25 tasks can
 * legitimately take several minutes, and reclaiming a task that is still
 * running would execute it twice for no reason. Long enough to be safe, short
 * enough that a crashed worker's tasks resume within one deploy cycle.
 */
export const QUEUE_LEASE_TIMEOUT_MS = 15 * 60 * 1000;

export const queueLeaseCutoff = (
  now: Date = new Date(),
  leaseMs: number = QUEUE_LEASE_TIMEOUT_MS,
): Date => new Date(now.getTime() - leaseMs);

export const QUEUE_LEASE_EXPIRED_ERROR =
  "Worker stopped before the task finished (reservation lease expired).";

/**
 * What to do with a task whose lease expired.
 *
 * The attempt was already counted when the task was claimed, so a crashed run
 * has spent one - which is what stops a handler that reliably kills its process
 * from being retried forever. With attempts left the task goes back to
 * `pending` and is available immediately; with none it is `failed`, carrying an
 * error that says what happened rather than an empty `lastError` an operator
 * has to guess at.
 *
 * Generic queue behaviour, not workflow behaviour: any task benefits, and the
 * Workflow Engine depends on it because a step that is stuck in `processing`
 * forever is an execution that never advances and never fails - the one state a
 * durable engine must not have.
 */
export const resolveStaleQueueLease = ({
  attempts,
  maxAttempts,
  now = new Date(),
}: {
  attempts: number;
  maxAttempts: number;
  now?: Date;
}): QueueTaskOutcome =>
  attempts < maxAttempts
    ? {
        availableAt: now,
        lastError: QUEUE_LEASE_EXPIRED_ERROR,
        status: "pending",
      }
    : {
        completedAt: now,
        lastError: QUEUE_LEASE_EXPIRED_ERROR,
        status: "failed",
      };
