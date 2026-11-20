import type { Context } from "hono";

import { z } from "zod";

import { buildQueueTask } from "@/builders";

const USERS_PER_TASK = 5000;

export const recountReputationQueueTask = buildQueueTask({
  name: "reactions-recount-reputation",
  payload: z.object({
    /** Users to recount; omit for everyone. */
    userIds: z
      .array(z.number().int().positive())
      .max(USERS_PER_TASK)
      .optional(),
  }),
  description:
    "Recompute members' reputation from the current points of the reactions they received",
  maxAttempts: 3,
  leaseSeconds: 15 * 60,
  handler: async (c, { userIds }) => {
    const { recountReputation } =
      await import("../../../lib/reactions/reputation");
    await recountReputation(c, userIds);
  },
});

/** Queues a recount of `userIds` (everyone without it), in chunks the payload allows. */
export const queueReputationRecount = async (
  c: Context,
  userIds?: readonly number[],
): Promise<void> => {
  const queue = c.get("queue");
  if (!userIds) {
    await queue.dispatch(recountReputationQueueTask, {});

    return;
  }
  for (let index = 0; index < userIds.length; index += USERS_PER_TASK) {
    await queue.dispatch(recountReputationQueueTask, {
      userIds: userIds.slice(index, index + USERS_PER_TASK),
    });
  }
};
