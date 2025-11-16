import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import { and, eq, type SQL } from "drizzle-orm";

import { blog_categories } from "@/database/categories";
import { blog_posts } from "@/database/posts";

export const zodPostSchema = z.object({
  id: z.number(),
  title: z.string(),
  titleSeo: z.string(),
  content: z.string(),
  categoryId: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  category: z.object({
    id: z.number(),
    title: z.string(),
    titleSeo: z.string(),
  }),
});

const zodPostsQuerySchema = zodPaginationQuery.extend({
  order: z.enum(["asc", "desc"]).optional(),
  orderBy: z.enum(["updatedAt", "createdAt"]).optional(),
  categoryId: z.string().transform(Number).optional(),
});

export const postsRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    request: {
      query: zodPostsQuerySchema,
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
    const query = c.req.valid("query") as z.infer<typeof zodPostsQuerySchema>;

    const data = await withPagination({
      c,
      params: {
        query,
      },
      primaryCursor: blog_posts.id,
      query: async ({ limit, where, orderBy }) => {
        const paginationWhere = where as SQL | undefined;

        let categoryFilter: SQL | undefined;
        if (typeof query.categoryId === "number") {
          const categoryIdFilterValue = query.categoryId as number;
          categoryFilter = eq(blog_posts.categoryId, categoryIdFilterValue);
        }

        let combinedWhere: SQL | undefined;
        if (categoryFilter && paginationWhere) {
          combinedWhere = and(paginationWhere, categoryFilter);
        } else {
          combinedWhere = categoryFilter ?? paginationWhere;
        }

        const baseQuery = c
          .get("db")
          .select({
            id: blog_posts.id,
            title: blog_posts.title,
            titleSeo: blog_posts.titleSeo,
            content: blog_posts.content,
            categoryId: blog_posts.categoryId,
            createdAt: blog_posts.createdAt,
            updatedAt: blog_posts.updatedAt,
            category: {
              id: blog_categories.id,
              title: blog_categories.title,
              titleSeo: blog_categories.titleSeo,
            },
          })
          .from(blog_posts)
          .innerJoin(
            blog_categories,
            eq(blog_posts.categoryId, blog_categories.id),
          );

        const filteredQuery = combinedWhere
          ? baseQuery.where(combinedWhere)
          : baseQuery;

        return await filteredQuery.orderBy(orderBy).limit(limit);
      },
      table: blog_posts,
      orderBy: {
        column: query.orderBy
          ? blog_posts[query.orderBy]
          : blog_posts.updatedAt,
        order: query.order ?? "desc",
      },
    });

    return c.json(data);
  },
});
