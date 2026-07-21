import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";

import { saveCategoryTranslations } from "../../../../lib/categories-language";
import { zodCreateCategorySchema } from "./create.route";

const zodCategoryResponseSchema = z.object({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const editCategoryRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "categories", permission: "can_edit" },
  route: {
    method: "put",
    path: "/{id}",
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
      body: {
        content: {
          "application/json": {
            schema: zodCreateCategorySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodCategoryResponseSchema,
          },
        },
        description: "Category updated successfully",
      },
      400: {
        description: "Bad request - Invalid input data",
      },
      404: {
        description: "Category not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { title, color } = c.req.valid("json");
    const [editData] = await c
      .get("db")
      .select({ id: blog_categories.id })
      .from(blog_categories)
      .where(eq(blog_categories.id, id))
      .limit(1);

    if (!editData) {
      throw new HTTPException(404);
    }

    const [category] = await c
      .get("db")
      .update(blog_categories)
      .set({
        color: color?.trim() ? color : null,
      })
      .where(eq(blog_categories.id, id))
      .returning();

    await saveCategoryTranslations(c, id, { title });

    return c.json(category);
  },
});
