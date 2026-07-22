import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

export const deleteCategoryRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "categories", permission: "can_delete" },
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

    // Capture the posts the category's `onDelete: "cascade"` is about to
    // remove, so listeners (e.g. search index cleanup) know what went away.
    const posts = await c
      .get("db")
      .select({ id: blog_posts.id })
      .from(blog_posts)
      .where(eq(blog_posts.categoryId, id));

    const result = await c
      .get("db")
      .delete(blog_categories)
      .where(eq(blog_categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new HTTPException(404);
    }

    await c.get("events").emit("blog.category.deleted", {
      categoryId: id,
      postIds: posts.map(post => post.id),
    });

    return c.body(null, 204);
  },
});
