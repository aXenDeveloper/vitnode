import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import { core_languages_words } from "@vitnode/core/database/languages";
import { and, eq, inArray } from "drizzle-orm";
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

const zodPostResponseSchema = z.object({
  id: z.number(),
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const zodMultiLangValue = ({
  max,
  min,
}: { max?: number; min?: number } = {}) => {
  let value = z.string();
  if (min !== undefined) {
    value = value.min(min);
  }
  if (max !== undefined) {
    value = value.max(max);
  }

  return z.array(z.object({ languageCode: z.string(), value }));
};

export const zodCreatePostSchema = z.object({
  title: zodMultiLangValue({ min: 3, max: 255 }).min(1),
  content: zodMultiLangValue(),
  friendlyUrl: zodMultiLangValue({ min: 1, max: 255 }).min(1),
  categoryId: z.number(),
});

export const createPostRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "posts", permission: "can_create" },
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

    // The friendly URL is the post's public slug and lives in
    // `core_languages_words`; keep it globally unique so two posts can't resolve
    // to the same URL.
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
      .insert(blog_posts)
      .values({
        categoryId,
        authorId: c.get("admin")?.user.id ?? c.get("user")?.id ?? null,
      })
      .returning();

    await savePostTranslations(c, post.id, { title, content, friendlyUrl });
    await reindexBlogPost(c, post);

    return c.json(post, 201);
  },
});
