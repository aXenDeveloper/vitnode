import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  lt,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";

import type { QueueTaskConfig } from "@/api/lib/queue";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { QueueDeferError } from "@/api/lib/queue";
import { core_queue } from "@/database/queue";
import { resolveQueueTaskOutcome } from "@/lib/api/resolve-queue-task-outcome";

const QUEUE_BATCH_SIZE = 25;
const QUEUE_CONCURRENCY = 5;
const QUEUE_LOCK_KEY = "queue:process";
const QUEUE_LOCK_TTL_SECONDS = 55;
const QUEUE_DRAIN_BUDGET_MS = 45_000;
const QUEUE_RETENTION_DAYS = 7;
const DEFAULT_QUEUE_LEASE_SECONDS = 600;

const DEDICATED_QUEUES = ["ai"] as const;

interface ProcessQueueOptions {
  batchSize?: number;
  /** How many tasks of one batch run at the same time. */
  concurrency?: number;
  lockKey?: string;
  /** Stop after this many batches even when more tasks are waiting. */
  maxBatches?: number;
  queues?: string[];
}

const recoverAbandonedQueueTasks = async (
  c: Context<EnvVitNode>,
  now: Date,
): Promise<void> => {
  const leases = new Map(
    c
      .get("core")
      .queue.map(task => [
        `${task.pluginId}:${task.name}`,
        task.leaseSeconds ?? DEFAULT_QUEUE_LEASE_SECONDS,
      ]),
  );
  const shortest = Math.min(DEFAULT_QUEUE_LEASE_SECONDS, ...leases.values());
  const db = c.get("db");

  const stuck = await db
    .select({
      attempts: core_queue.attempts,
      id: core_queue.id,
      maxAttempts: core_queue.maxAttempts,
      name: core_queue.name,
      pluginId: core_queue.pluginId,
      reservedAt: core_queue.reservedAt,
    })
    .from(core_queue)
    .where(
      and(
        eq(core_queue.status, "processing"),
        lt(core_queue.reservedAt, new Date(now.getTime() - shortest * 1000)),
      ),
    )
    .limit(100);

  for (const task of stuck) {
    const lease =
      leases.get(`${task.pluginId}:${task.name}`) ??
      DEFAULT_QUEUE_LEASE_SECONDS;
    if (
      !task.reservedAt ||
      task.reservedAt.getTime() > now.getTime() - lease * 1000
    ) {
      continue;
    }
    const exhausted = task.attempts >= task.maxAttempts;
    await db
      .update(core_queue)
      .set({
        completedAt: exhausted ? now : null,
        lastError: "Abandoned: the worker did not finish within its lease",
        reservedAt: null,
        status: exhausted ? "failed" : "pending",
      })
      .where(
        and(
          eq(core_queue.id, task.id),
          eq(core_queue.status, "processing"),
          eq(core_queue.reservedAt, task.reservedAt),
        ),
      );
  }
};

type QueueRow = typeof core_queue.$inferSelect;

const claimQueueTasks = async (
  c: Context<EnvVitNode>,
  where: SQL | undefined,
  now: Date,
  batchSize = QUEUE_BATCH_SIZE,
): Promise<QueueRow[]> =>
  await c.get("db").transaction(async tx => {
    const rows = await tx
      .select({ id: core_queue.id })
      .from(core_queue)
      .where(
        and(
          eq(core_queue.status, "pending"),
          lte(core_queue.availableAt, now),
          where,
        ),
      )
      .orderBy(desc(core_queue.priority), asc(core_queue.id))
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return [];

    return await tx
      .update(core_queue)
      .set({
        status: "processing",
        reservedAt: now,
        attempts: sql`${core_queue.attempts} + 1`,
      })
      .where(
        inArray(
          core_queue.id,
          rows.map(row => row.id),
        ),
      )
      .returning();
  });

interface QueueTaskResult {
  availableAt: Date;
  completedAt: Date | null;
  deferred: boolean;
  lastError: null | string;
  status: QueueRow["status"];
}

const runQueueTask = async (
  c: Context<EnvVitNode>,
  task: QueueRow,
  handlerMap: Map<string, QueueTaskConfig>,
): Promise<QueueTaskResult> => {
  const key = `${task.pluginId}:${task.name}`;
  const registered = handlerMap.get(key);
  let error: null | string = null;

  if (!registered) {
    error = `No handler registered for queue task "${key}"`;
    await c.get("log").warn(error);
  } else {
    try {
      await registered.handler(c, task.payload);
    } catch (err) {
      if (err instanceof QueueDeferError) {
        return {
          availableAt: err.until,
          completedAt: null,
          deferred: true,
          lastError: err.message,
          status: "pending",
        };
      }
      error = err instanceof Error ? err.message : String(err);
      await c.get("log").error(`Queue task "${key}" failed: ${error}`);
    }
  }

  const outcome = resolveQueueTaskOutcome({
    attempts: task.attempts,
    maxAttempts: task.maxAttempts,
    error,
  });

  return {
    availableAt: outcome.availableAt ?? task.availableAt,
    completedAt: outcome.completedAt ?? null,
    deferred: false,
    lastError: outcome.lastError,
    status: outcome.status,
  };
};

// Saved as each task finishes, not once the batch is done: a finished task
// waiting on a slow sibling could outlive its lease and be run again. Fenced
// by the claim, so a task the recovery loop already reclaimed is left alone.
const saveQueueTaskResult = async (
  c: Context<EnvVitNode>,
  task: QueueRow,
  result: QueueTaskResult,
): Promise<void> => {
  await c
    .get("db")
    .update(core_queue)
    .set({
      attempts: result.deferred
        ? sql`GREATEST(${core_queue.attempts} - 1, 0)`
        : undefined,
      availableAt: result.availableAt,
      completedAt: result.completedAt,
      lastError: result.lastError,
      reservedAt: null,
      status: result.status,
    })
    .where(
      and(
        eq(core_queue.id, task.id),
        eq(core_queue.status, "processing"),
        task.reservedAt
          ? eq(core_queue.reservedAt, task.reservedAt)
          : undefined,
      ),
    );
};

const runClaimedQueueTasks = async (
  c: Context<EnvVitNode>,
  claimed: QueueRow[],
  concurrency = QUEUE_CONCURRENCY,
): Promise<void> => {
  if (claimed.length === 0) return;

  const handlerMap = new Map(
    c.get("core").queue.map(task => [`${task.pluginId}:${task.name}`, task]),
  );
  let next = 0;
  // `runQueueTask` never rejects for a handler failure, so a plain worker pool
  // is enough: each worker pulls the next task until the batch is drained.
  const worker = async () => {
    while (next < claimed.length) {
      const task = claimed[next++];
      await saveQueueTaskResult(
        c,
        task,
        await runQueueTask(c, task, handlerMap),
      );
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, claimed.length)) },
      worker,
    ),
  );
};

export const processQueueTasksByIds = async (
  c: Context<EnvVitNode>,
  ids: number[],
): Promise<void> => {
  if (ids.length === 0) return;

  const claimed = await claimQueueTasks(
    c,
    inArray(core_queue.id, ids),
    new Date(),
  );
  await runClaimedQueueTasks(c, claimed);
};

export const processQueueTasks = async (
  c: Context<EnvVitNode>,
  {
    batchSize = QUEUE_BATCH_SIZE,
    concurrency = QUEUE_CONCURRENCY,
    lockKey = QUEUE_LOCK_KEY,
    maxBatches = Number.POSITIVE_INFINITY,
    queues,
  }: ProcessQueueOptions = {},
): Promise<void> => {
  const gotLock = await c
    .get("cache")
    .acquireLock(lockKey, QUEUE_LOCK_TTL_SECONDS);
  if (!gotLock) return;
  const lockedAt = Date.now();

  try {
    await recoverAbandonedQueueTasks(c, new Date());

    const queueFilter = queues
      ? inArray(core_queue.queue, queues)
      : notInArray(core_queue.queue, [...DEDICATED_QUEUES]);

    // Keep claiming until the queue is empty, but never start a batch after
    // the drain budget: that leaves the rest of the lock TTL for the batch in
    // flight, so the lock is still ours whenever we claim. A batch that runs
    // past the TTL is still safe - claims use `FOR UPDATE SKIP LOCKED`.
    for (
      let batch = 0;
      batch < maxBatches && Date.now() - lockedAt < QUEUE_DRAIN_BUDGET_MS;
      batch++
    ) {
      const claimed = await claimQueueTasks(
        c,
        queueFilter,
        new Date(),
        batchSize,
      );
      if (claimed.length === 0) break;

      await runClaimedQueueTasks(c, claimed, concurrency);
    }
  } finally {
    // Past the TTL the key may already belong to another instance's run.
    if (Date.now() - lockedAt < QUEUE_LOCK_TTL_SECONDS * 1000) {
      await c.get("cache").releaseLock(lockKey);
    }
  }
};

const QUEUE_RETENTION_BATCH_SIZE = 1000;
const QUEUE_RETENTION_MAX_BATCHES = 100;

/**
 * Remove finished tasks older than the retention window, a bounded batch at a
 * time so one hourly run never holds a long lock on a large queue table.
 */
export const deleteExpiredQueueTasks = async (
  c: Context<EnvVitNode>,
): Promise<void> => {
  const db = c.get("db");
  const cutoff = new Date(
    Date.now() - QUEUE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  for (let batch = 0; batch < QUEUE_RETENTION_MAX_BATCHES; batch++) {
    const rows = await db
      .delete(core_queue)
      .where(
        inArray(
          core_queue.id,
          db
            .select({ id: core_queue.id })
            .from(core_queue)
            .where(
              and(
                inArray(core_queue.status, ["completed", "failed"]),
                lt(core_queue.completedAt, cutoff),
              ),
            )
            .limit(QUEUE_RETENTION_BATCH_SIZE),
        ),
      )
      .returning({ id: core_queue.id });

    if (rows.length < QUEUE_RETENTION_BATCH_SIZE) break;
  }
};
