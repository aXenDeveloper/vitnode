import { z } from "zod";

import { buildQueueTask } from "@/api/builders";

export const altGenerateQueueTask = buildQueueTask({
  name: "alt-generate",
  payload: z.object({ fileId: z.number().int() }),
  description:
    "Describe one image and translate its ALT text into missing languages",
  maxAttempts: 3,
  leaseSeconds: 15 * 60,
  handler: async (c, { fileId }) => {
    const { processAltForFile } = await import("../../../lib/ai/alt");
    await processAltForFile(c, fileId);
  },
});
