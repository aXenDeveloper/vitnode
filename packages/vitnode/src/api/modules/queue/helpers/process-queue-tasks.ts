import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { core_queue } from "@/database/queue";
import { resolveQueueTaskOutcome } from "@/lib/api/resolve-queue-task-outcome";

const QUEUE_BATCH_SIZE = 25;
const QUEUE_LOCK_KEY = "queue:process";
const QUEUE_LOCK_TTL_SECONDS = 55;
const QUEUE_RETENTION_DAYS = 7;
/**
 * A task still `processing` after this long belonged to a worker that died
 * mid-run. Handlers must stay well under it - long work saves progress and
 * re-queues itself instead.
 */
export const QUEUE_STALE_PROCESSING_MINUTES = 15;

type QueueRow = typeof core_queue.$inferSelect;

/** Claims due tasks matching `where`, skipping rows another worker holds. */
const claimQueueTasks = async (
  c: Context<EnvVitNode>,
  where: SQL | undefined,
  now: Date,
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
      .limit(QUEUE_BATCH_SIZE)
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

const runClaimedQueueTasks = async (
  c: Context<EnvVitNode>,
  claimed: QueueRow[],
): Promise<void> => {
  if (claimed.length === 0) return;

  const handlerMap = new Map(
    c.get("core").queue.map(task => [`${task.pluginId}:${task.name}`, task]),
  );

  for (const task of claimed) {
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
        error = err instanceof Error ? err.message : String(err);
        await c.get("log").error(`Queue task "${key}" failed: ${error}`);
      }
    }

    const outcome = resolveQueueTaskOutcome({
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      error,
    });

    await c
      .get("db")
      .update(core_queue)
      .set({
        status: outcome.status,
        lastError: outcome.lastError,
        availableAt: outcome.availableAt ?? task.availableAt,
        completedAt: outcome.completedAt ?? null,
        reservedAt: null,
      })
      .where(eq(core_queue.id, task.id));
  }
};

/**
 * Puts tasks whose worker died mid-run back in line - or fails them once
 * they have used every attempt - so a crash never strands a task in
 * `processing` forever.
 */
export const reclaimStaleQueueTasks = async (
  c: Context<EnvVitNode>,
  now: Date = new Date(),
): Promise<number> => {
  const stale = lt(
    core_queue.reservedAt,
    new Date(now.getTime() - QUEUE_STALE_PROCESSING_MINUTES * 60_000),
  );
  const message = "The worker stopped before the task finished.";
  const db = c.get("db");

  const failed = await db
    .update(core_queue)
    .set({
      completedAt: now,
      lastError: message,
      reservedAt: null,
      status: "failed",
    })
    .where(
      and(
        eq(core_queue.status, "processing"),
        stale,
        sql`${core_queue.attempts} >= ${core_queue.maxAttempts}`,
      ),
    )
    .returning({ id: core_queue.id });

  const retried = await db
    .update(core_queue)
    .set({
      availableAt: now,
      lastError: message,
      reservedAt: null,
      status: "pending",
    })
    .where(and(eq(core_queue.status, "processing"), stale))
    .returning({ id: core_queue.id });

  return failed.length + retried.length;
};

/**
 * Runs specific tasks right away, outside the worker's tick - used to start a
 * request's own work once its response is sent. Uses the same claim, so a task
 * the worker already took (or that never committed) is simply skipped.
 */
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
): Promise<void> => {
  const gotLock = await c
    .get("cache")
    .acquireLock(QUEUE_LOCK_KEY, QUEUE_LOCK_TTL_SECONDS);
  if (!gotLock) return;

  try {
    const db = c.get("db");
    const now = new Date();

    await reclaimStaleQueueTasks(c, now);
    await runClaimedQueueTasks(c, await claimQueueTasks(c, undefined, now));

    const cutoff = new Date(
      now.getTime() - QUEUE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    await db
      .delete(core_queue)
      .where(
        and(
          inArray(core_queue.status, ["completed", "failed"]),
          lt(core_queue.completedAt, cutoff),
        ),
      );
  } finally {
    await c.get("cache").releaseLock(QUEUE_LOCK_KEY);
  }
};
