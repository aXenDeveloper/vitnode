import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  contentPublicListTag,
} from "@vitnode/core/content";
import { HTTPException } from "hono/http-exception";

import { buildModule, buildRoute } from "@/api/builders";
import { postContent } from "@/database/posts";

const postSlugRoute = buildRoute({
  route: {
    method: "get",
    path: "/{id}/slug",
    description:
      "The friendly URL of one public article in a locale, for building a comment permalink",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
      query: z.object({
        locale: z.string().max(CONTENT_LOCALE_MAX_LENGTH).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ id: z.number(), slug: z.string() }),
          },
        },
        description: "The article's friendly URL in the requested locale",
      },
      404: { description: "No public article with this id" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { locale } = c.req.valid("query");
    const service = postContent.publicService?.(c);
    if (!service) {
      throw new HTTPException(500, { message: "Articles have no public API." });
    }

    const post = await service.findById(id, { locale });
    if (!post) throw new HTTPException(404, { message: "Article not found." });

    setPageCacheTags(c, [contentPublicListTag(postContent.definition.id)]);

    return c.json({ id: post.id, slug: post.friendlyUrl }, 200);
  },
});

export const postsModule = buildModule({
  name: "posts",
  routes: [postSlugRoute],
});
