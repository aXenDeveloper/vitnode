import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { removeSpecialCharacters } from "@vitnode/core/lib/special-characters";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";

const zodCategoryResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const zodCreateCategorySchema = z.object({
  title: z.string(),
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
    const titleSeo = removeSpecialCharacters(title);
    const [titleSEODuplocate] = await c
      .get("db")
      .select({
        titleSeo: blog_categories.titleSeo,
      })
      .from(blog_categories)
      .where(eq(blog_categories.titleSeo, titleSeo))
      .limit(1);

    if (titleSEODuplocate?.titleSeo === titleSeo) {
      throw new HTTPException(400, {
        message: "Category with this title already exists.",
      });
    }

    const [category] = await c
      .get("db")
      .insert(blog_categories)
      .values({
        title,
        color: color || null,
        titleSeo: removeSpecialCharacters(title),
      })
      .returning();

    return c.json(category, 201);
  },
});
