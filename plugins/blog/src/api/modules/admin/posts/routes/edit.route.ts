import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { core_languages_words } from "@vitnode/core/database/languages";
import { and, eq, inArray, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

import {
  POST_LANG_TABLE,
  savePostTranslations,
  slugifyMultiLang,
} from "../../../../lib/posts-language";
import { reindexBlogPost } from "../../../../lib/search";
import { zodCreatePostSchema } from "./create.route";

const zodPostResponseSchema = z.object({
  id: z.number(),
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
    const { title, content, friendlyUrl, categoryId } = c.req.valid("json");
    const slugFriendlyUrl = slugifyMultiLang(friendlyUrl);
    const friendlyUrlValues = [
      ...new Set(slugFriendlyUrl.map(item => item.value).filter(Boolean)),
    ];

    if (friendlyUrlValues.length === 0) {
      throw new HTTPException(400, {
        message: "Friendly URL is required.",
      });
    }

    const [existingPost] = await c
      .get("db")
      .select({ id: blog_posts.id })
      .from(blog_posts)
      .where(eq(blog_posts.id, id))
      .limit(1);

    if (!existingPost) {
      throw new HTTPException(404, { message: "Post not found." });
    }

    const [category] = await c
      .get("db")
      .select({ id: blog_categories.id })
      .from(blog_categories)
      .where(eq(blog_categories.id, categoryId))
      .limit(1);

    if (!category) {
      throw new HTTPException(404, { message: "Category not found." });
    }

    // Keep the friendly URL (the public slug, stored in `core_languages_words`)
    // globally unique, excluding this post's own rows.
    const [duplicate] = await c
      .get("db")
      .select({ itemId: core_languages_words.itemId })
      .from(core_languages_words)
      .where(
        and(
          eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
          eq(core_languages_words.tableName, POST_LANG_TABLE),
          eq(core_languages_words.variable, "friendlyUrl"),
          inArray(core_languages_words.value, friendlyUrlValues),
          ne(core_languages_words.itemId, id),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new HTTPException(400, {
        message: "Post with this title already exists.",
      });
    }

    const [post] = await c
      .get("db")
      .update(blog_posts)
      .set({
        categoryId,
      })
      .where(eq(blog_posts.id, id))
      .returning();

    await savePostTranslations(c, id, { title, content, friendlyUrl });
    await reindexBlogPost(c, post);

    return c.json(post);
  },
});
