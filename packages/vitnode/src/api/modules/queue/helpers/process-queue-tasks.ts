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

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { QueueDeferError } from "@/api/lib/queue";
import { core_queue } from "@/database/queue";
import { resolveQueueTaskOutcome } from "@/lib/api/resolve-queue-task-outcome";

const QUEUE_BATCH_SIZE = 25;
const QUEUE_LOCK_KEY = "queue:process";
const QUEUE_LOCK_TTL_SECONDS = 55;
const QUEUE_RETENTION_DAYS = 7;
/** A task running longer than this is presumed abandoned (its process died). */
export const DEFAULT_QUEUE_LEASE_SECONDS = 600;

/**
 * Queues the general worker leaves alone. AI work runs on its own cron with
 * its own small batch, so a slow model never holds up e-mails.
 */
export const DEDICATED_QUEUES = ["ai"] as const;

export interface ProcessQueueOptions {
  batchSize?: number;
  lockKey?: string;
  /** Process only these queues; omit for every queue not dedicated elsewhere. */
  queues?: string[];
}

/**
 * Tasks stuck in `processing` past their lease go back to `pending` - the
 * attempt is spent - or to `failed` when none are left. Without this, a crash
 * mid-task left it `processing` forever.
 */
export const recoverAbandonedQueueTasks = async (
  c: Context<EnvVitNode>,
  now = new Date(),
): Promise<number> => {
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

  let recovered = 0;
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
    // Conditional on the reservation we saw: a task its worker finished in
    // the meantime is left alone.
    const updated = await db
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
      )
      .returning({ id: core_queue.id });
    recovered += updated.length;
  }

  return recovered;
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

const runClaimedQueueTasks = async (
  c: Context<EnvVitNode>,
  claimed: QueueRow[],
): Promise<void> => {
  if (claimed.length === 0) return;

  const db = c.get("db");
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
        if (err instanceof QueueDeferError) {
          await db
            .update(core_queue)
            .set({
              attempts: sql`GREATEST(${core_queue.attempts} - 1, 0)`,
              availableAt: err.until,
              lastError: err.message,
              reservedAt: null,
              status: "pending",
            })
            .where(eq(core_queue.id, task.id));
          continue;
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

    await db
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
    lockKey = QUEUE_LOCK_KEY,
    queues,
  }: ProcessQueueOptions = {},
): Promise<void> => {
  const gotLock = await c
    .get("cache")
    .acquireLock(lockKey, QUEUE_LOCK_TTL_SECONDS);
  if (!gotLock) return;

  try {
    const db = c.get("db");
    const now = new Date();

    await recoverAbandonedQueueTasks(c, now);

    const queueFilter = queues
      ? inArray(core_queue.queue, queues)
      : notInArray(core_queue.queue, [...DEDICATED_QUEUES]);
    await runClaimedQueueTasks(
      c,
      await claimQueueTasks(c, queueFilter, now, batchSize),
    );

    // Queue rows are a work list, never a record: AI spending and history
    // live in core_ai_runs, which this cleanup does not touch.
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
    await c.get("cache").releaseLock(lockKey);
  }
};
