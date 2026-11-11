import type { EnvVariablesVitNode } from "@vitnode/core/api/middlewares/global.middleware";

import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  articleCorrectionsCache,
  articleCorrectionsGenerationCache,
} from "@/api/cache/article-corrections.cache";
import { correctionFiledEvent } from "@/api/events";
import { announceCorrectionTask } from "@/api/tasks/announce-correction.task";
import { newsroom_articles } from "@/database/articles";
import { newsroom_corrections } from "@/database/corrections";

import type { FileCorrectionInput } from "./corrections.schema";

/** What the corrections service needs, passed in by whoever builds it. */
export interface CorrectionsServiceDeps {
  /** In a route: `c.get("cache")`. */
  cache: Pick<EnvVariablesVitNode["cache"], "entry">;
  /** In a route: `c.get("db")`. `file` opens its own transaction on it. */
  db: Omit<EnvVariablesVitNode["db"], "$client">;
  /** In a route: `c.get("events")`. */
  events: Pick<EnvVariablesVitNode["events"], "emit">;
  /** In a route: `c.get("queue")`. */
  queue: Pick<EnvVariablesVitNode["queue"], "dispatch">;
}

/** What `file` resolves to. The stored row includes who filed it - never return it as is. */
export type FileCorrectionResult =
  | { correction: typeof newsroom_corrections.$inferSelect; ok: true }
  | { error: "article_not_found"; ok: false };

/**
 * Article corrections: filing one and reading an article's list. Build it per
 * request from the context's capabilities:
 * `createCorrectionsService({ cache: c.get("cache"), db: c.get("db"), events: c.get("events"), queue: c.get("queue") })`.
 */
export const createCorrectionsService = ({
  cache,
  db,
  events,
  queue,
}: CorrectionsServiceDeps) => ({
  /**
   * Files a correction on an article. The row and its announcement task commit
   * together, so the task is queued only when the correction is stored. Only
   * after that commit does it move the article's corrections generation - so
   * a list a reader loaded before the write can never become the cached one -
   * and then emit the event. A rolled-back write does neither.
   */
  file: async ({
    actor,
    articleId,
    body,
  }: FileCorrectionInput & {
    actor: { id: number };
  }): Promise<FileCorrectionResult> => {
    const correction = await db.transaction(async tx => {
      const [article] = await tx
        .select({ id: newsroom_articles.id })
        .from(newsroom_articles)
        .where(eq(newsroom_articles.id, articleId))
        .limit(1);
      if (!article) return null;

      const [row] = await tx
        .insert(newsroom_corrections)
        .values({ articleId, body, createdById: actor.id })
        .returning();
      if (!row) throw new Error("Inserting the correction returned no row.");

      await queue.dispatch(
        announceCorrectionTask,
        { correctionId: row.id },
        { tx },
      );

      return row;
    });
    if (!correction) return { error: "article_not_found", ok: false };

    await cache
      .entry(articleCorrectionsGenerationCache, articleId)
      .set(randomUUID());
    await events.emit(correctionFiledEvent, {
      articleId,
      correctionId: correction.id,
    });

    return { correction, ok: true };
  },

  /**
   * An article's corrections, newest first, read through the cache under the
   * generation captured before loading.
   */
  listForArticle: async (articleId: number) => {
    const generations = cache.entry(
      articleCorrectionsGenerationCache,
      articleId,
    );
    const generation =
      (await generations.get()) ??
      (await generations.setIfMissing(randomUUID()));

    return await cache
      .entry(articleCorrectionsCache, articleId, generation)
      .remember(async () => {
        const rows = await db
          .select({
            body: newsroom_corrections.body,
            createdAt: newsroom_corrections.createdAt,
            id: newsroom_corrections.id,
          })
          .from(newsroom_corrections)
          .where(eq(newsroom_corrections.articleId, articleId))
          .orderBy(desc(newsroom_corrections.id));

        return {
          corrections: rows.map(row => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
        };
      });
  },
});
