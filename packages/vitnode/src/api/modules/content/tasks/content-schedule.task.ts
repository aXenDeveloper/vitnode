import { z } from "zod";

import { buildQueueTask } from "@/api/builders";
import { CONTENT_QUEUE_TASK_SCHEDULE } from "@/content/const";

export const contentScheduleQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_SCHEDULE,
  payload: z.object({
    generation: z.number().int().positive(),
    scheduleId: z.number().int().positive(),
  }),
  description:
    "Publish or unpublish a content record at its scheduled time. A cancelled, rescheduled or already-executed schedule is a no-op.",
  handler: async (c, { generation, scheduleId }) => {
    const { executeContentSchedule } =
      await import("../lib/execute-content-schedule");
    const outcome = await executeContentSchedule(c, { generation, scheduleId });
    if (outcome.status === "executed") return;

    const message = `[content-schedule] ${scheduleId}: ${outcome.status}${outcome.reason ? ` (${outcome.reason})` : ""}`;

    // A skip is the normal, healthy outcome for a superseded task, so it is
    // `debug` - but silence would make "the schedule never fired" impossible to
    // tell from "it fired and correctly did nothing". An unregistered content
    // type is a real misconfiguration, so that one is a warning.
    await (outcome.status === "unregistered"
      ? c.get("log").warn(message)
      : c.get("log").debug(message));
  },
});
