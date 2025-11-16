import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import { and, ilike, type SQL } from "drizzle-orm";

import { blog_categories } from "@/database/categories";

const zodCategorySchema = z.object({
  id: z.number(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const zodCategoriesQuerySchema = zodPaginationQuery.extend({
  order: z.enum(["asc", "desc"]).optional(),
  orderBy: z.enum(["updatedAt"]).optional(),
  search: z.string().optional(),
});

export const categoriesRoute = buildRoute({
  route: {
    method: "get",
    path: "/",
    request: {
      query: zodCategoriesQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              edges: z.array(zodCategorySchema),
              pageInfo: zodPaginationPageInfo,
            }),
          },
        },
        description: "Categories retrieved successfully",
      },
    },
  },
  handler: async c => {
    const query = c.req.valid("query") as z.infer<
      typeof zodCategoriesQuerySchema
    >;

    const data = await withPagination({
      c,
      params: {
        query,
      },
      primaryCursor: blog_categories.id,
      query: async ({ limit, where, orderBy }) => {
        const paginationWhere = where as SQL | undefined;
        const searchCondition = query.search
          ? ilike(blog_categories.title, `%${query.search}%`)
          : undefined;

        let combinedWhere: SQL | undefined;
        if (searchCondition && paginationWhere) {
          combinedWhere = and(paginationWhere, searchCondition);
        } else {
          combinedWhere = searchCondition ?? paginationWhere;
        }

        const baseQuery = c.get("db").select().from(blog_categories);

        const filteredQuery = combinedWhere
          ? baseQuery.where(combinedWhere)
          : baseQuery;

        return await filteredQuery.orderBy(orderBy).limit(limit);
      },
      table: blog_categories,
      orderBy: {
        column: query.orderBy
          ? blog_categories[query.orderBy]
          : blog_categories.updatedAt,
        order: query.order ?? "desc",
      },
    });

    return c.json(data);
  },
});
