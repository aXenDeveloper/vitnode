import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { multiLangValueSchema } from "@vitnode/core/lib/helpers/multi-lang";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";

import { saveCategoryTranslations } from "../../../../lib/categories-language";

const zodCategoryResponseSchema = z.object({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const zodCreateCategorySchema = z.object({
  title: multiLangValueSchema({ minLength: 1, maxLength: 100 }).min(1),
  color: z.string().nullish(),
});

export const createCategoryRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "categories", permission: "can_create" },
  route: {
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": {
            schema: zodCreateCategorySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: zodCategoryResponseSchema,
          },
        },
        description: "Category created successfully",
      },
      400: {
        description: "Bad request - Invalid input data",
      },
    },
  },
  handler: async c => {
    const { title, color } = c.req.valid("json");
    const [category] = await c
      .get("db")
      .insert(blog_categories)
      .values({
        color: color?.trim() ? color : null,
      })
      .returning();

    await saveCategoryTranslations(c, category.id, { title });

    return c.json(category, 201);
  },
});
