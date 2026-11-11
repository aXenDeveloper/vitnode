import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { articleContent } from "@/database/articles";

import { zodArticleCorrections } from "../corrections.schema";
import { createCorrectionsService } from "../corrections.service";

export const listCorrectionsRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    description: "The corrections filed on one public article, newest first",
    request: {
      query: z.object({
        articleId: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: zodArticleCorrections } },
        description: "The article's corrections",
      },
      404: { description: "No public article with this id" },
    },
  },
  handler: async c => {
    const { articleId } = c.req.valid("query");
    const article = await articleContent.publicService?.(c).findById(articleId);
    if (!article) {
      throw new HTTPException(404, { message: "Article not found." });
    }

    const corrections = await createCorrectionsService({
      cache: c.get("cache"),
      db: c.get("db"),
      events: c.get("events"),
      queue: c.get("queue"),
    }).listForArticle(articleId);

    return c.json(corrections, 200);
  },
});
