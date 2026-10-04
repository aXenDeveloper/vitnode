import { z } from "zod";

import { ALT_TASK_NAME, processAltForFile } from "@/api/lib/ai/alt";
import { buildQueueTask } from "@/api/lib/queue";

export const altGenerateQueueTask = buildQueueTask({
  name: ALT_TASK_NAME,
  description:
    "Describe one image and translate its ALT text into missing languages",
  maxAttempts: 3,
  // One image: a vision call and a few short translations.
  leaseSeconds: 15 * 60,
  handler: async (c, payload) => {
    const { fileId } = z.object({ fileId: z.number().int() }).parse(payload);
    await processAltForFile(c, fileId);
  },
});
