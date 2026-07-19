import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type {
  SearchHit,
  SearchProviderApiPlugin,
  SearchQueryParams,
  SearchResult,
} from "@/api/models/search";

import { core_search_index, resolveSearchTextConfig } from "@/database/search";
import { core_users } from "@/database/users";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const buildFilters = (params: SearchQueryParams): SQL | undefined => {
  const conditions: SQL[] = [];

  const term = params.term?.trim();
  if (term) {
    // Match the config the row's vector was built with (scoped by locale, else
    // `simple`) so `websearch_to_tsquery` stems the term the same way.
    const config = resolveSearchTextConfig(params.languageCode);
    conditions.push(
      sql`"core_search_index"."search_vector" @@ websearch_to_tsquery(${config}::regconfig, ${term})`,
    );
  }
  if (params.languageCode) {
    // Language-agnostic rows (empty `languageCode`) match every locale.
    const languageCondition = or(
      eq(core_search_index.languageCode, params.languageCode),
      eq(core_search_index.languageCode, ""),
    );
    if (languageCondition) {
      conditions.push(languageCondition);
    }
  }
  if (params.itemTypes?.length) {
    conditions.push(inArray(core_search_index.itemType, params.itemTypes));
  }
  if (params.authorId !== undefined) {
    conditions.push(eq(core_search_index.authorId, params.authorId));
  }
  if (params.containerId !== undefined) {
    conditions.push(eq(core_search_index.containerId, params.containerId));
  }
  if (params.dateFrom) {
    conditions.push(gte(core_search_index.createdAt, params.dateFrom));
  }
  if (params.dateTo) {
    conditions.push(lte(core_search_index.createdAt, params.dateTo));
  }
  if (!params.includePrivate) {
    conditions.push(eq(core_search_index.isPublic, true));
  }

  return conditions.length ? and(...conditions) : undefined;
};

export const PostgresSearchAdapter = (): SearchProviderApiPlugin => ({
  name: "postgres",
  capabilities: { authorBoost: false, facets: false, timeDecay: false },

  // The SearchModel owns the canonical `core_search_index` table, which is this
  // provider's store, so the write methods are intentionally no-ops.
  index: async () => undefined,
  bulkIndex: async () => undefined,
  delete: async () => undefined,
  clear: async () => undefined,

  ping: async c => {
    try {
      await c.get("db").execute(sql`select 1`);

      return true;
    } catch {
      return false;
    }
  },

  search: async (
    c: Context,
    params: SearchQueryParams,
  ): Promise<SearchResult> => {
    const db = c.get("db");
    const term = params.term?.trim();
    const useRelevance = params.sort === "relevance" && !!term;
    const size = Math.min(params.first ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const filters = buildFilters(params);

    const [{ total }] = await db
      .select({ total: count() })
      .from(core_search_index)
      .where(filters);

    const config = resolveSearchTextConfig(params.languageCode);
    const rankExpr = term
      ? sql<number>`ts_rank("core_search_index"."search_vector", websearch_to_tsquery(${config}::regconfig, ${term}))`
      : sql<null | number>`NULL`;

    const cursorValue = params.cursor ? Number(params.cursor) : undefined;

    const orderBy: SQL[] = [];
    let where = filters;
    let offset = 0;

    if (useRelevance) {
      orderBy.push(sql`${rankExpr} DESC`, desc(core_search_index.id));
      offset = cursorValue ?? 0;
    } else if (params.sort === "oldest") {
      orderBy.push(asc(core_search_index.createdAt), asc(core_search_index.id));
      if (cursorValue) {
        const cond = gt(core_search_index.id, cursorValue);
        where = where ? and(where, cond) : cond;
      }
    } else {
      orderBy.push(
        desc(core_search_index.createdAt),
        desc(core_search_index.id),
      );
      if (cursorValue) {
        const cond = lt(core_search_index.id, cursorValue);
        where = where ? and(where, cond) : cond;
      }
    }

    const rows = await db
      .select({
        id: core_search_index.id,
        pluginId: core_search_index.pluginId,
        itemType: core_search_index.itemType,
        itemId: core_search_index.itemId,
        languageCode: core_search_index.languageCode,
        authorId: core_search_index.authorId,
        title: core_search_index.title,
        content: core_search_index.content,
        containerType: core_search_index.containerType,
        containerId: core_search_index.containerId,
        url: core_search_index.url,
        metadata: core_search_index.metadata,
        createdAt: core_search_index.createdAt,
        score: rankExpr,
        author: {
          id: core_users.id,
          name: core_users.name,
          nameCode: core_users.nameCode,
          avatarColor: core_users.avatarColor,
        },
      })
      .from(core_search_index)
      .leftJoin(core_users, eq(core_users.id, core_search_index.authorId))
      .where(where)
      .orderBy(...orderBy)
      .limit(size + 1)
      .offset(useRelevance ? offset : 0);

    const hasNextPage = rows.length > size;
    const sliced = rows.slice(0, size);

    const edges: SearchHit[] = sliced.map(row => ({
      id: row.id,
      pluginId: row.pluginId,
      itemType: row.itemType,
      itemId: row.itemId,
      languageCode: row.languageCode,
      authorId: row.authorId,
      title: row.title,
      content: row.content,
      containerType: row.containerType,
      containerId: row.containerId,
      url: row.url,
      metadata: row.metadata,
      createdAt: row.createdAt,
      score: row.score,
      author: row.author?.id ? row.author : null,
    }));

    const startCursor = useRelevance ? offset : (edges[0]?.id ?? null);
    const endCursor = useRelevance
      ? offset + edges.length
      : (edges.at(-1)?.id ?? null);

    return {
      edges,
      pageInfo: {
        totalCount: total,
        count: edges.length,
        hasNextPage,
        hasPreviousPage: useRelevance ? offset > 0 : !!cursorValue,
        startCursor,
        endCursor,
      },
    };
  },
});
