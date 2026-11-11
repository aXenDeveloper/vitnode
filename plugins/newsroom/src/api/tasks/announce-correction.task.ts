import { eq } from "drizzle-orm";
import { z } from "zod";

import { buildQueueTask } from "@/api/builders";
import { newsroom_articles } from "@/database/articles";
import { newsroom_corrections } from "@/database/corrections";

/**
 * Announces a filed correction. Queued in the same transaction as the
 * correction, so it runs only for one that was committed.
 */
export const announceCorrectionTask = buildQueueTask({
  name: "announce-correction",
  payload: z.object({ correctionId: z.number().int().positive() }),
  maxAttempts: 5,
  handler: async (c, { correctionId }) => {
    const [correction] = await c
      .get("db")
      .select({ title: newsroom_articles.title })
      .from(newsroom_corrections)
      .innerJoin(
        newsroom_articles,
        eq(newsroom_articles.id, newsroom_corrections.articleId),
      )
      .where(eq(newsroom_corrections.id, correctionId))
      .limit(1);
    if (!correction) return;

    await c
      .get("log")
      .debug(
        `[newsroom] Correction #${correctionId} on "${correction.title}" announced.`,
      );
  },
});
