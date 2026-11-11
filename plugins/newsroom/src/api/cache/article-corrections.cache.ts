import { z } from "zod";

import { defineCacheEntry } from "@/api/builders";
import { zodArticleCorrections } from "@/api/modules/corrections/corrections.schema";

/**
 * One article's corrections generation: a random token that filing a
 * correction replaces. Lists are cached under the token a reader captured
 * before loading, so a reader that loaded rows before the write can only fill
 * an old generation that nobody reads again.
 *
 * Kept longer than the lists it fences. When it expires or is lost, the next
 * reader starts a new random token - never a previous one - so an old list
 * cannot become current again; the cost is one cold read.
 */
export const articleCorrectionsGenerationCache = defineCacheEntry({
  name: "article-corrections.generation",
  version: 1,
  key: (articleId: number) => [articleId],
  schema: z.string().min(1),
  ttlSeconds: 24 * 60 * 60,
});

/** One article's public corrections, under the article's current generation. */
export const articleCorrectionsCache = defineCacheEntry({
  name: "article-corrections",
  version: 2,
  key: (articleId: number, generation: string) => [articleId, generation],
  schema: zodArticleCorrections,
  ttlSeconds: 600,
});
