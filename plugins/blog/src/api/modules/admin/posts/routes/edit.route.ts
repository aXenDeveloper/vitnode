import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { removeSpecialCharacters } from "@vitnode/core/lib/special-characters";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

import { buildBlogPostSearchDocument } from "../../../../lib/search";
import { zodCreatePostSchema } from "./create.route";

const zodPostResponseSchema = z.object({
  id: z.number(),
  title: z.string(),
  titleSeo: z.string(),
  content: z.string(),
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const editPostRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "posts", permission: "can_edit" },
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
            schema: zodCreatePostSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: zodPostResponseSchema,
          },
        },
        description: "Post updated successfully",
      },
      400: {
        description: "Bad request - Invalid input data",
      },
      404: {
        description: "Post or category not found",
      },
    },
  },
  handler: async c => {
    const { id } = c.req.valid("param");
    const { title, content, categoryId } = c.req.valid("json");
    const titleSeo = removeSpecialCharacters(title);

    // Check if post exists
    const [existingPost] = await c
      .get("db")
      .select({ titleSeo: blog_posts.titleSeo })
      .from(blog_posts)
      .where(eq(blog_posts.id, id))
      .limit(1);

    if (!existingPost) {
      throw new HTTPException(404, { message: "Post not found." });
    }

    // Check if category exists
    const [category] = await c
      .get("db")
      .select({ id: blog_categories.id })
      .from(blog_categories)
      .where(eq(blog_categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new HTTPException(404, { message: "Category not found." });
    }

    // Check if title SEO already exists (but not for the current post)
    const [titleSEODuplicate] = await c
      .get("db")
      .select({ titleSeo: blog_posts.titleSeo })
      .from(blog_posts)
      .where(eq(blog_posts.titleSeo, titleSeo))
      .limit(1);

    if (
      titleSEODuplicate?.titleSeo === titleSeo &&
      titleSEODuplicate.titleSeo !== existingPost.titleSeo
    ) {
      throw new HTTPException(400, {
        message: "Post with this title already exists.",
      });
    }

    const [post] = await c
      .get("db")
      .update(blog_posts)
      .set({
        title,
        titleSeo,
        content,
        categoryId,
      })
      .where(eq(blog_posts.id, id))
      .returning();

    await c.get("search").index(buildBlogPostSearchDocument(post));

    return c.json(post);
  },
});
