import { and, eq, inArray } from "drizzle-orm";

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
    .select({ id: core_queue.id })
    .from(core_queue)
    .where(
      and(
        eq(core_queue.pluginId, NOTIFICATIONS_PLUGIN_ID),
        eq(core_queue.name, QUEUE_NOTIFICATIONS_EMAIL),
        inArray(core_queue.status, ["pending"]),
      ),
    )
    .limit(1);
  if (queued) return;

  await c.get("queue").dispatch({
    availableAt,
    name: QUEUE_NOTIFICATIONS_EMAIL,
    pluginId: NOTIFICATIONS_PLUGIN_ID,
    tx: db,
  });
};
