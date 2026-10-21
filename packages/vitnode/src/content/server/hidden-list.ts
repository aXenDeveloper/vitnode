import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";

import {
  contentPublicReadCondition,
  publicationColumns,
  publishedCondition,
} from "./publication";

/**
 * Which hidden records a public list may add for the viewer: every one of them
 * for an editor of the content type (`all`), otherwise the ones whose
 * `search.authorField` names `authorId`.
 */
export interface ContentPublicHiddenAccess {
  all: boolean;
  authorId: null | number;
}

/** A public list row, with `hidden: true` when only its authors and editors may see it. */
export interface ContentPublicHiddenFlag {
  hidden?: true;
}

interface ContentHiddenSource {
  advanced?: ContentAdvancedStore;
  columns: Record<string, PgColumn>;
  definition: AnyContentTypeDefinition;
}

const authoredBy = (
  { advanced, columns, definition }: ContentHiddenSource,
  authorId: null | number,
): SQL | undefined => {
  const field = definition.search.authorField;
  if (!field || authorId === null) return undefined;

  if (advanced?.fields.includes(field)) {
    return advanced.membershipCondition(field, { contains: authorId });
  }

  const column = columns[field];

  return column ? eq(column, authorId) : undefined;
};

export const contentViewableHiddenCondition = (
  source: ContentHiddenSource,
  access: ContentPublicHiddenAccess,
): SQL | undefined => {
  if (!source.definition.visibility.enabled) return undefined;

  const scope = access.all ? undefined : authoredBy(source, access.authorId);
  if (!access.all && !scope) return undefined;

  return and(
    contentPublicReadCondition(
      publicationColumns(source.definition, source.columns),
      { hidden: true },
    ),
    scope,
  );
};

/**
 * The base-row condition of a public list: published, visible records plus the
 * hidden ones `access` may see. Pair it with `contentListHiddenAccess` for
 * your own list or count queries, and never cache a result read with `access`
 * for everybody.
 */
export const contentPublicListCondition = (
  source: ContentHiddenSource,
  access: ContentPublicHiddenAccess | undefined,
): SQL | undefined => {
  const published = publishedCondition(
    publicationColumns(source.definition, source.columns),
  );
  const hidden = access
    ? contentViewableHiddenCondition(source, access)
    : undefined;

  return hidden ? or(published, hidden) : published;
};

export const flagHiddenContentRows = async <TRow extends { id?: unknown }>(
  c: Context,
  {
    columns,
    rows,
    table,
  }: {
    columns: Record<string, PgColumn>;
    rows: TRow[];
    table: PgTable;
  },
): Promise<(ContentPublicHiddenFlag & TRow)[]> => {
  const ids = rows.map(row => row.id);
  const { hiddenAt, id } = columns;
  const hidden =
    hiddenAt && id && ids.length > 0
      ? await c
          .get("db")
          .select({ id })
          .from(table)
          .where(and(inArray(id, ids), isNotNull(hiddenAt)))
      : [];
  const hiddenIds = new Set(hidden.map(row => String(row.id)));

  return rows.map(row => ({
    ...row,
    hidden: hiddenIds.has(String(row.id)) ? (true as const) : undefined,
  }));
};
