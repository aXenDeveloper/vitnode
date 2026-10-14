import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import {
  and,
  arrayContains,
  arrayOverlaps,
  eq,
  gte,
  inArray,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { SearchQueryParams } from "@/api/models/search";

import { core_search_index, resolveSearchTextConfig } from "@/database/search";

const requestedTranslation = alias(
  core_search_index,
  "search_requested_translation",
);

const visibleCondition = (
  table: Record<"authorIds" | "isHidden" | "isPublic" | "itemType", PgColumn>,
  params: SearchQueryParams,
): SQL | undefined => {
  if (params.includePrivate) return undefined;

  const access = params.hiddenAccess;
  const viewer = or(
    access?.authorId === undefined
      ? undefined
      : arrayContains(table.authorIds, [access.authorId]),
    access?.itemTypes.length
      ? inArray(table.itemType, [...access.itemTypes])
      : undefined,
  );

  return viewer
    ? or(eq(table.isPublic, true), and(eq(table.isHidden, true), viewer))
    : eq(table.isPublic, true);
};

const fallbackLanguageConditions = (
  c: Context,
  params: SearchQueryParams,
  languageCode: string,
): SQL[] =>
  (params.languageFallbacks ?? []).flatMap(fallback => {
    const condition = and(
      eq(core_search_index.itemType, fallback.itemType),
      eq(core_search_index.languageCode, fallback.languageCode),
      notExists(
        c
          .get("db")
          .select({ id: requestedTranslation.id })
          .from(requestedTranslation)
          .where(
            and(
              eq(requestedTranslation.itemType, core_search_index.itemType),
              eq(requestedTranslation.itemId, core_search_index.itemId),
              eq(requestedTranslation.languageCode, languageCode),
              visibleCondition(requestedTranslation, params),
            ),
          )
          .offset(0),
      ),
    );

    return condition ? [condition] : [];
  });

export const searchIndexFilters = (
  c: Context,
  params: SearchQueryParams,
): SQL | undefined => {
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
      ...fallbackLanguageConditions(c, params, params.languageCode),
    );
    if (languageCondition) {
      conditions.push(languageCondition);
    }
  }
  if (params.itemTypes?.length) {
    conditions.push(inArray(core_search_index.itemType, params.itemTypes));
  }
  if (params.authorId !== undefined) {
    conditions.push(
      arrayContains(core_search_index.authorIds, [params.authorId]),
    );
  }
  if (params.authorIds?.length) {
    conditions.push(
      arrayOverlaps(core_search_index.authorIds, [...params.authorIds]),
    );
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
  const visible = visibleCondition(core_search_index, params);
  if (visible) conditions.push(visible);

  return conditions.length ? and(...conditions) : undefined;
};
