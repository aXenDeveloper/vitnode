import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { blog_categories } from "@/database/categories";

export const deleteCategoryRoute = buildRoute({
  route: {
    method: "delete",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
    },
    responses: {
      204: {
        description: "Category deleted successfully",
      },
      404: {
        description: "Category not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");

    const result = await c
      .get("db")
      .delete(blog_categories)
      .where(eq(blog_categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new HTTPException(404);
    }

    return c.body(null, 204);
  },
});
