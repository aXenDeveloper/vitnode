import { z } from "@hono/zod-openapi";

/** A correction as readers see it: never who filed it. */
export const zodCorrection = z.object({
  body: z.string(),
  createdAt: z.iso.datetime(),
  id: z.number().int().positive(),
});

/** One article's corrections, newest first. Also the cached value. */
export const zodArticleCorrections = z.object({
  corrections: z.array(zodCorrection),
});

export const zodFileCorrectionBody = z.object({
  articleId: z.number().int().positive(),
  body: z.string().trim().min(3).max(1000),
});

export type FileCorrectionInput = z.infer<typeof zodFileCorrectionBody>;
