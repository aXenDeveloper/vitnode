import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { removeSpecialCharacters } from "@vitnode/core/lib/special-characters";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

const zodPostResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  titleSeo: z.string(),
  content: z.string(),
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const zodCreatePostSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters long")
    .max(255, "Title must not exceed 255 characters"),
  content: z.string(),
  categoryId: z.number(),
});

export const createPostRoute = buildRoute({
  route: {
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": {
            schema: zodCreatePostSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: zodPostResponseSchema,
          },
        },
        description: "Post created successfully",
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
    const { title, content, categoryId } = c.req.valid("json") as z.infer<
      typeof zodCreatePostSchema
    >;
    const titleSeo: string = removeSpecialCharacters(title);

    // Check if category exists
    const [category] = await c
      .get("db")
      .select({ id: blog_categories.id })
      .from(blog_categories)
      .where(eq(blog_categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new HTTPException(404, {
        message: "Category not found.",
      });
    }

    // Check if title SEO already exists
    const [titleSEODuplicate] = await c
      .get("db")
      .select({ titleSeo: blog_posts.titleSeo })
      .from(blog_posts)
      .where(eq(blog_posts.titleSeo, titleSeo))
      .limit(1);

    if (titleSEODuplicate?.titleSeo === titleSeo) {
      throw new HTTPException(400, {
        message: "Post with this title already exists.",
      });
    }

    const [post] = await c
      .get("db")
      .insert(blog_posts)
      .values({
        title,
        titleSeo,
        content,
        categoryId,
      })
      .returning();

    return c.json(post, 201);
  },
});
