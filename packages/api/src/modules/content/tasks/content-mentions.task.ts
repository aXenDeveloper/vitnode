import { z } from "zod";

import { buildQueueTask } from "@/builders";
import { CONTENT_QUEUE_TASK_MENTIONS } from "@/content/const";

export const contentMentionsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_MENTIONS,
  payload: z.object({
    /** Who made the write; the record's author wins when it has one. */
    actorId: z.number().int().positive().nullable(),
    contentTypeId: z.string().min(1),
    /** The record was deleted: forget its mentions and retract them. */
    deleted: z.boolean(),
    itemId: z.string().min(1),
    pluginId: z.string().min(1),
  }),
  description:
    "Sync a record's @mentions with its text after a write: notify newly mentioned members who can read it, retract removed mentions. Idempotent.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    const { processContentMentions } =
      await import("../../../content/server/mentions");
    await processContentMentions(c, payload);
  },
});
