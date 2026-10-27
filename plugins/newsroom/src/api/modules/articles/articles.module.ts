import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import { contentPublicListTag } from "@vitnode/core/content";
import { HTTPException } from "hono/http-exception";

import { buildModule, buildRoute } from "@/api/builders";
import { articleContent } from "@/database/articles";

const articleSlugRoute = buildRoute({
  route: {
    method: "get",
    path: "/{id}/slug",
    description:
      "The slug of one public article, for turning a comment permalink into the comment under its article",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number(), slug: z.string() }),
          },
        },
        description: "The article's slug",
      },
      404: { description: "No public article with this id" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const service = articleContent.publicService?.(c);
    if (!service) {
      throw new HTTPException(500, { message: "Articles have no public API." });
    }

    const article = await service.findById(id);
    if (!article)
      throw new HTTPException(404, { message: "Article not found." });

    setPageCacheTags(c, [contentPublicListTag(articleContent.definition.id)]);

    return c.json({ id: article.id, slug: article.slug }, 200);
  },
});

export const articlesModule = buildModule({
  name: "articles",
  routes: [articleSlugRoute],
});
