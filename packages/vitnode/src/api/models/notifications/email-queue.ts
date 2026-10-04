import { and, asc, eq } from "drizzle-orm";

import { core_queue } from "@/database/queue";

import type { NotificationsContext, NotificationsDb } from "./shared";

import { NOTIFICATIONS_PLUGIN_ID, QUEUE_NOTIFICATIONS_EMAIL } from "./shared";

/**
 * Makes sure one email drain is queued. Drains are idempotent - each claims
 * deliveries with `SKIP LOCKED` - so a second one racing in is harmless; this
 * only keeps a burst from queueing hundreds of them.
 */
export const dispatchEmailDrain = async (
  c: NotificationsContext,
  tx?: NotificationsDb,
  availableAt?: Date,
): Promise<void> => {
  const db = tx ?? c.get("db");
  const [queued] = await db
    .select({ availableAt: core_queue.availableAt, id: core_queue.id })
    .from(core_queue)
    .where(
      and(
        eq(core_queue.pluginId, NOTIFICATIONS_PLUGIN_ID),
        eq(core_queue.name, QUEUE_NOTIFICATIONS_EMAIL),
        eq(core_queue.status, "pending"),
      ),
    )
    .orderBy(asc(core_queue.availableAt))
    .limit(1);
  if (queued) {
    const wanted = availableAt ?? new Date();
    if (queued.availableAt > wanted) {
      await db
        .update(core_queue)
        .set({ availableAt: wanted })
        .where(eq(core_queue.id, queued.id));
    }

    return;
  }

  await c.get("queue").dispatch({
    availableAt,
    name: QUEUE_NOTIFICATIONS_EMAIL,
    pluginId: NOTIFICATIONS_PLUGIN_ID,
    tx: db,
  });
};
