import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import { and, ilike, type SQL } from "drizzle-orm";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";

const zodCategorySchema = z.object({
  id: z.number(),
  title: z.string(),
  color: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const categoriesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/",
    request: {
      query: zodPaginationQuery.extend({
        order: z.enum(["asc", "desc"]).optional(),
        orderBy: z.enum(["updatedAt"]).optional(),
        search: z.string().optional(),
      }),
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
    const query = c.req.valid("query");

    const data = await withPagination({
      c,
      params: {
        query,
      },
      primaryCursor: blog_categories.id,
      query: async ({ limit, where, orderBy }) => {
        const searchCondition = query.search
          ? ilike(blog_categories.title, `%${query.search}%`)
          : undefined;

        let combinedWhere: SQL | undefined;
        if (searchCondition) {
          if (where) {
            combinedWhere = and(where, searchCondition);
          } else {
            combinedWhere = searchCondition;
          }
        } else {
          combinedWhere = where;
        }

        return await c
          .get("db")
          .select()
          .from(blog_categories)
          .where(combinedWhere)
          .orderBy(orderBy)
          .limit(limit);
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
