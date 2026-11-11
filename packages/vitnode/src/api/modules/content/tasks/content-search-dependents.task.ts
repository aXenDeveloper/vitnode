import { z } from "zod";

import type { QueueTaskPayload } from "@/api/lib/queue";

import { buildQueueTask } from "@/api/builders";
import { CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS } from "@/content/const";

export const contentSearchDependentsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS,
  payload: z.object({
    /** The dependent's cursor: the last id the request already reindexed. */
    after: z.union([z.number().int(), z.string().min(1)]),
    /** The record whose title or URL the dependents carry. */
    contentTypeId: z.string().min(1),
    dependentTypeId: z.string().min(1),
    field: z.string().min(1),
    itemId: z.union([z.number().int(), z.string().min(1)]),
  }),
  description:
    "Reindex the rest of a record's dependents - comments carrying its title or URL - after an edit whose request wrote only the first page.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    const { runContentSearchDependentsTask } =
      await import("../../../../content/server/search-sync");
    await runContentSearchDependentsTask(c, payload);
  },
});

export type ContentSearchDependentsPayload = QueueTaskPayload<
  typeof contentSearchDependentsQueueTask
>;
