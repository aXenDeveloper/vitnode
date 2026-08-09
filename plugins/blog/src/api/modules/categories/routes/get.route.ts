import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";
import {
  withPagination,
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@vitnode/core/api/lib/with-pagination";
import { core_languages_words } from "@vitnode/core/database/languages";
import { multiLangValueSchema } from "@vitnode/core/lib/helpers/multi-lang";
import {
  and,
  eq,
  getTableColumns,
  ilike,
  inArray,
  type SQL,
} from "drizzle-orm";

import { CONFIG_PLUGIN } from "@/const";
import { blog_categories } from "@/database/categories";

import {
  CATEGORY_LANG_TABLE,
  CATEGORY_LANG_VARIABLE,
  loadCategoryTranslations,
} from "../../../lib/categories-language";

const zodMultiLangValue = multiLangValueSchema();

export const zodCategorySchema = z.object({
  id: z.number(),
  // The title lives in `core_languages_words`; the client resolves this array to
  // the active locale (see `getLangValue`).
  titleTranslations: zodMultiLangValue,
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
      query: async ({ cursorSelection, limit, where, orderBy }) => {
        // The title lives in `core_languages_words`, so search resolves matching
        // category ids from there rather than a column on `blog_categories`.
        const searchCondition = query.search
          ? inArray(
              blog_categories.id,
              c
                .get("db")
                .select({ id: core_languages_words.itemId })
                .from(core_languages_words)
                .where(
                  and(
                    eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
                    eq(core_languages_words.tableName, CATEGORY_LANG_TABLE),
                    eq(core_languages_words.variable, CATEGORY_LANG_VARIABLE),
                    ilike(core_languages_words.value, `%${query.search}%`),
                  ),
                ),
            )
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
          .select({ ...getTableColumns(blog_categories), ...cursorSelection })
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

    const translations = await loadCategoryTranslations(
      c,
      data.edges.map(edge => edge.id),
    );

    return c.json({
      ...data,
      edges: data.edges.map(edge => ({
        ...edge,
        titleTranslations: translations.get(edge.id) ?? [],
      })),
    });
  },
});
