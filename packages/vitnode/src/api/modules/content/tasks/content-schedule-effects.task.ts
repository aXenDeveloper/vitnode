import { buildQueueTask } from "@/api/lib/queue";
import { CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS } from "@/content/const";
import {
  contentScheduleEffectsPayloadSchema,
  runContentScheduleEffects,
} from "@/content/server/schedule-effects";

/**
 * Announces a scheduled transition that has already committed.
 *
 * Unlike `content-schedule`, the payload here **is** data rather than a pointer,
 * and deliberately so: the record may have been edited again by the time this
 * runs, and an event describing the record's current state would announce
 * something other than the publication it is reporting. Everything travels
 * frozen from the transaction that wrote it.
 *
 * Five attempts rather than three. The failures this retries are transient by
 * nature - a search node restarting, a web app redeploying - and the backoff
 * (10s, 20s, 40s, 80s) is a far better fit for those than for a deadlock.
 */
export const contentScheduleEffectsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS,
  description:
    "Emit the event, sync search and expire the cache for a scheduled publish or unpublish that has already committed. Never republishes.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    const input = contentScheduleEffectsPayloadSchema.parse(payload);
    const outcome = await runContentScheduleEffects(c, input);

    if (outcome.status === "unregistered") {
      await c
        .get("log")
        .warn(
          `[content-schedule-effects] ${input.scheduleId}: ${input.contentTypeId} is no longer registered, so nothing was announced.`,
        );
    }
  },
});
