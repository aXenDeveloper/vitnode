import type { Context } from "hono";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";

import type { SearchQueryParams } from "@/api/models/search";

import {
  core_search_index,
  core_search_popularity,
  searchTitleVector,
} from "@/database/search";

import { searchIndexFilters } from "./search-filters";

export interface SearchSuggestion {
  context: null | string;
  createdAt: Date;
  excerpt: string;
  id: number;
  imageId: null | number;
  itemId: string;
  itemType: string;
  title: string;
  url: string;
}

export const MAX_SEARCH_SUGGESTIONS = 10;

const SEARCH_SUGGESTION_EXCERPT_LENGTH = 500;

const MAX_PREFIX_WORDS = 8;
const MAX_PREFIX_WORD_LENGTH = 64;
const POPULAR_CANDIDATES_PER_SLOT = 3;
const SUGGESTION_CANDIDATES_PER_SOURCE = 100;

const searchPrefixQuery = (term: string): null | string => {
  const words = (
    term
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  )
    .slice(0, MAX_PREFIX_WORDS)
    .map(word => `${word.slice(0, MAX_PREFIX_WORD_LENGTH)}:*`);

  return words.length > 0 ? words.join(" & ") : null;
};

const contextTitleOf = (metadata: Record<string, unknown>): null | string => {
  const context = metadata.context;
  if (typeof context !== "object" || context === null) return null;

  const title: unknown = Reflect.get(context, "title");

  return typeof title === "string" && title !== "" ? title : null;
};

const suggestionColumns = {
  createdAt: core_search_index.createdAt,
  excerpt: sql<string>`left(${core_search_index.content}, ${SEARCH_SUGGESTION_EXCERPT_LENGTH})`,
  id: core_search_index.id,
  imageId: core_search_index.imageId,
  itemId: core_search_index.itemId,
  itemType: core_search_index.itemType,
  metadata: core_search_index.metadata,
  title: core_search_index.title,
  url: core_search_index.url,
};

const toSuggestions = (
  rows: {
    createdAt: Date;
    excerpt: string;
    id: number;
    imageId: null | number;
    itemId: string;
    itemType: string;
    metadata: Record<string, unknown>;
    title: string;
    url: null | string;
  }[],
): SearchSuggestion[] =>
  rows.flatMap(({ metadata, url, ...row }) =>
    url === null ? [] : [{ ...row, context: contextTitleOf(metadata), url }],
  );

const popularityOfIndexRow = and(
  eq(core_search_popularity.itemType, core_search_index.itemType),
  eq(core_search_popularity.itemId, core_search_index.itemId),
);

export const canonicalSearchSuggestions = async (
  c: Context,
  {
    limit,
    params,
    term,
  }: { limit: number; params: SearchQueryParams; term: string },
): Promise<SearchSuggestion[]> => {
  const prefixQuery = searchPrefixQuery(term);
  if (prefixQuery === null) return [];

  const db = c.get("db");
  const tsQuery = sql`to_tsquery('simple'::regconfig, ${prefixQuery})`;
  const titleVector = searchTitleVector(core_search_index.title);
  const matching = and(
    searchIndexFilters(c, { ...params, term: undefined }),
    isNotNull(core_search_index.url),
    sql`${titleVector} @@ ${tsQuery}`,
  );

  const recent = db
    .$with("search_suggest_recent")
    .as(
      db
        .select({ id: core_search_index.id })
        .from(core_search_index)
        .where(matching)
        .orderBy(desc(core_search_index.createdAt))
        .limit(SUGGESTION_CANDIDATES_PER_SOURCE),
    );
  const popular = db
    .$with("search_suggest_popular")
    .as(
      db
        .select({ id: core_search_index.id })
        .from(core_search_popularity)
        .innerJoin(core_search_index, popularityOfIndexRow)
        .where(matching)
        .orderBy(desc(core_search_popularity.logScore))
        .limit(SUGGESTION_CANDIDATES_PER_SOURCE),
    );

  const rows = await db
    .with(recent, popular)
    .select(suggestionColumns)
    .from(core_search_index)
    .leftJoin(core_search_popularity, popularityOfIndexRow)
    .where(
      inArray(
        core_search_index.id,
        union(
          db.select({ id: recent.id }).from(recent),
          db.select({ id: popular.id }).from(popular),
        ),
      ),
    )
    .orderBy(
      sql`ts_rank(${titleVector}, ${tsQuery}) DESC`,
      sql`${core_search_popularity.logScore} DESC NULLS LAST`,
      desc(core_search_index.createdAt),
    )
    .limit(limit);

  return toSuggestions(rows);
};

export const canonicalPopularSearchItems = async (
  c: Context,
  { limit, params }: { limit: number; params: SearchQueryParams },
): Promise<SearchSuggestion[]> => {
  const requestedLanguage = params.languageCode ?? "";

  const rows = await c
    .get("db")
    .select(suggestionColumns)
    .from(core_search_popularity)
    .innerJoin(core_search_index, popularityOfIndexRow)
    .where(
      and(
        searchIndexFilters(c, { ...params, term: undefined }),
        isNotNull(core_search_index.url),
      ),
    )
    .orderBy(
      desc(core_search_popularity.logScore),
      sql`${core_search_index.languageCode} = ${requestedLanguage} DESC`,
    )
    .limit(limit * POPULAR_CANDIDATES_PER_SLOT);

  const seen = new Set<string>();
  const unique = rows.filter(row => {
    const key = `${row.itemType}\u0000${row.itemId}`;
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });

  return toSuggestions(unique.slice(0, limit));
};
