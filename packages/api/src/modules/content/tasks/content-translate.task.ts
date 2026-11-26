import { z } from "zod";

import { buildQueueTask } from "@/builders";

export const contentTranslateQueueTask = buildQueueTask({
  name: "content-translate",
  payload: z.object({
    jobIds: z.array(z.number().int().positive()).min(1).max(120),
  }),
  description:
    "Machine-translate queued fields of public records into readers' languages",
  maxAttempts: 5,
  leaseSeconds: 10 * 60,
  handler: async (c, { jobIds }) => {
    const { processAutoTranslateJobs } =
      await import("../../../lib/content-translation/worker");
    await processAutoTranslateJobs(c, jobIds);
  },
});
