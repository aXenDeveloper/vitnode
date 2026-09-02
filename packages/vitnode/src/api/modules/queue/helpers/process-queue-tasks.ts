import type { Context } from "hono";

import { and, asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { core_queue } from "@/database/queue";
import { resolveQueueTaskOutcome } from "@/lib/api/resolve-queue-task-outcome";
import {
  queueLeaseCutoff,
  resolveStaleQueueLease,
} from "@/lib/api/resolve-stale-queue-lease";

const QUEUE_BATCH_SIZE = 25;
const QUEUE_LOCK_KEY = "queue:process";
const QUEUE_LOCK_TTL_SECONDS = 55;
const QUEUE_RETENTION_DAYS = 7;

/**
 * Drain due queue tasks. Correctness comes from Postgres
 * `FOR UPDATE SKIP LOCKED`, which lets many instances claim disjoint batches
 * safely; the optional Redis lock (`c.get("cache").acquireLock`) is only an
 * optimization so a single instance drains per tick when Redis is configured.
 */
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

    await recoverStaleQueueLeases(c, now);

    const claimed = await db.transaction(async tx => {
      const rows = await tx
        .select({ id: core_queue.id })
        .from(core_queue)
        .where(
          and(
            eq(core_queue.status, "pending"),
            lte(core_queue.availableAt, now),
          ),
        )
        .orderBy(desc(core_queue.priority), asc(core_queue.id))
        .limit(QUEUE_BATCH_SIZE)
        .for("update", { skipLocked: true });

      if (rows.length === 0) return [];

      return tx
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

    if (claimed.length > 0) {
      const handlerMap = new Map(
        c
          .get("core")
          .queue.map(task => [`${task.pluginId}:${task.name}`, task]),
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
    }

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

/**
 * Give back tasks whose worker never came back.
 *
 * The claim in `processQueueTasks` is a lease: a row is flipped to `processing`
 * before its handler runs, and the finishing update only happens if the process
 * survives. A deploy, an OOM kill or a container reschedule in between leaves
 * the row `processing` forever, and every later tick ignores it - the claim
 * query only ever selects `pending`.
 *
 * Runs before the claim so a recovered task can be picked up in the same tick.
 * Recovery counts against the task's own `maxAttempts` (the attempt was already
 * incremented when it was claimed), so a handler that reliably takes its
 * process down still fails eventually instead of cycling forever.
 */
const recoverStaleQueueLeases = async (
  c: Context<EnvVitNode>,
  now: Date,
): Promise<void> => {
  const db = c.get("db");
  const stale = await db
    .select({
      attempts: core_queue.attempts,
      id: core_queue.id,
      maxAttempts: core_queue.maxAttempts,
      name: core_queue.name,
      pluginId: core_queue.pluginId,
    })
    .from(core_queue)
    .where(
      and(
        eq(core_queue.status, "processing"),
        lt(core_queue.reservedAt, queueLeaseCutoff(now)),
      ),
    )
    .limit(QUEUE_BATCH_SIZE);

  if (stale.length === 0) return;

  for (const task of stale) {
    const outcome = resolveStaleQueueLease({
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      now,
    });

    await db
      .update(core_queue)
      .set({
        availableAt: outcome.availableAt ?? now,
        completedAt: outcome.completedAt ?? null,
        lastError: outcome.lastError,
        reservedAt: null,
        status: outcome.status,
      })
      .where(
        and(eq(core_queue.id, task.id), eq(core_queue.status, "processing")),
      );
  }

  await c
    .get("log")
    .warn(
      `Recovered ${stale.length} queue task(s) left in "processing" by a worker that stopped: ${stale
        .map(task => `${task.pluginId}:${task.name}#${task.id}`)
        .join(", ")}`,
    );
};
