import { z } from "@hono/zod-openapi";
import { setPageCacheTags } from "@vitnode/core/api/lib/page-cache";
import { contentPublicListTag } from "@vitnode/core/content";
import { createContentAccess } from "@vitnode/core/content/server";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { topicContent } from "@/database/topics";

import { json } from "../lib/json-response";
import { publicTopic } from "../lib/public-condition";

export const topicSlugRoute = buildRoute({
  route: {
    method: "get",
    path: "/topics/{id}/slug",
    description:
      "The public slug of one topic, for building a comment permalink",
    request: {
      params: z.object({
        id: z.coerce.number().int().positive().openapi({ example: 1 }),
      }),
    },
    responses: {
      200: json(
        z.object({ id: z.number(), slug: z.string() }),
        "The topic's slug",
      ),
      404: { description: "No public topic with this id" },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const topics = topicContent.table;

    const access = createContentAccess(c);
    const [row] = await c
      .get("db")
      .select({ id: topics.id, slug: topics.slug })
      .from(topics)
      .where(
        and(
          eq(topics.id, id),
          publicTopic(),
          await access.condition(topicContent, "read"),
        ),
      )
      .limit(1);

    if (!row) throw new HTTPException(404, { message: "Topic not found." });

    if (!(await access.isOpen(topicContent))) {
      return c.json({ id: row.id, slug: row.slug }, 200, {
        "Cache-Control": "private, no-store",
      });
    }

    setPageCacheTags(c, [contentPublicListTag(topicContent.definition.id)]);

    return c.json({ id: row.id, slug: row.slug }, 200);
  },
});
