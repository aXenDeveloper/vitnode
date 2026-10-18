import { buildQueueTask } from "@/api/lib/queue";
import {
  CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS,
  contentSearchDependentsPayloadSchema,
  runContentSearchDependentsTask,
} from "@/content/server/search-sync";

export const contentSearchDependentsQueueTask = buildQueueTask({
  name: CONTENT_QUEUE_TASK_SEARCH_DEPENDENTS,
  description:
    "Reindex the rest of a record's dependents - comments carrying its title or URL - after an edit whose request wrote only the first page.",
  maxAttempts: 5,
  handler: async (c, payload) => {
    await runContentSearchDependentsTask(
      c,
      contentSearchDependentsPayloadSchema.parse(payload),
    );
  },
});
