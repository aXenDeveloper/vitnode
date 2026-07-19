import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import { core_users } from "@vitnode/core/database/users";
import { eq } from "drizzle-orm";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

import { loadCategoryTranslations } from "../../../lib/categories-language";
import { loadPostTranslations } from "../../../lib/posts-language";

const zodMultiLangValue = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

export const zodPostSchema = z.object({
  id: z.number(),
  // Every translated field lives in `core_languages_words`; the client resolves
  // these arrays to the active locale (see `getLangValue` / `resolveLangValue`).
  titleTranslations: zodMultiLangValue,
  contentTranslations: zodMultiLangValue,
  friendlyUrlTranslations: zodMultiLangValue,
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({
    id: z.number(),
    titleTranslations: zodMultiLangValue,
  }),
  author: z
    .object({
      id: z.number(),
      name: z.string(),
      nameCode: z.string(),
      avatarColor: z.string(),
    })
    .nullable(),
});

export const postsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["updatedAt", "createdAt"]).optional(),
        categoryId: z.string().transform(Number).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodPostSchema),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "Posts retrieved successfully",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query");

    const data = await withPagination({
      c,
      params: {
        query,
      },
      primaryCursor: blog_posts.id,
      query: async ({ limit, where, orderBy }) =>
        await c
          .get("db")
          .select({
            id: blog_posts.id,
            categoryId: blog_posts.categoryId,
            createdAt: blog_posts.createdAt,
            updatedAt: blog_posts.updatedAt,
            category: {
              id: blog_categories.id,
            },
            author: {
              id: core_users.id,
              name: core_users.name,
              nameCode: core_users.nameCode,
              avatarColor: core_users.avatarColor,
            },
          })
          .from(blog_posts)
          .innerJoin(
            blog_categories,
            eq(blog_posts.categoryId, blog_categories.id),
          )
          .leftJoin(core_users, eq(core_users.id, blog_posts.authorId))
          .where(
            query.categoryId
              ? eq(blog_posts.categoryId, query.categoryId)
              : where,
          )
          .orderBy(orderBy)
          .limit(limit),
      table: blog_posts,
      orderBy: {
        column: query.orderBy
          ? blog_posts[query.orderBy]
          : blog_posts.updatedAt,
        order: query.order ?? "desc",
      },
    });

    const [translations, categoryTranslations] = await Promise.all([
      loadPostTranslations(
        c,
        data.edges.map(edge => edge.id),
      ),
      loadCategoryTranslations(
        c,
        data.edges.map(edge => edge.category.id),
      ),
    ]);

    return c.json({
      ...data,
      edges: data.edges.map(edge => {
        const words = translations.get(edge.id);

        return {
          ...edge,
          titleTranslations: words?.title ?? [],
          contentTranslations: words?.content ?? [],
          friendlyUrlTranslations: words?.friendlyUrl ?? [],
          category: {
            ...edge.category,
            titleTranslations: categoryTranslations.get(edge.category.id) ?? [],
          },
        };
      }),
    });
  },
});
