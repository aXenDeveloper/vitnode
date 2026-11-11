import { buildQueueTask } from "@/api/builders";
import { CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS } from "@/content/const";
import {
  contentScheduleEffectsPayloadSchema,
  runContentScheduleEffects,
} from "@/content/server/schedule-effects";

export const contentScheduleEffectsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_SCHEDULE_EFFECTS,
  payload: contentScheduleEffectsPayloadSchema,
  description:
    "Emit the event, sync search and expire the cache for a scheduled publish or unpublish that has already committed. Never republishes.",
  maxAttempts: 5,
  handler: async (c, input) => {
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
