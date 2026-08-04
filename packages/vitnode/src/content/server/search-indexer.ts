import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";

import { asc, count } from "drizzle-orm";

import type { SearchDocument, SearchIndexer } from "../../api/models/search";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { contentSearchIndexedFieldNames } from "../search";
import { publicationColumns, publishedCondition } from "./publication";
import { contentSearchDocument } from "./search-document";

/** System columns the mapper reads, on top of the configured search fields. */
const REQUIRED_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "status",
  "publishedAt",
] as const;

/**
 * Adapts one content type to the engine's {@link SearchIndexer} contract, so a
 * full or per-collection rebuild can stream its published records.
 *
 * Registered automatically by `buildContentAdminModule` for every content type
 * with `search: { enabled: true }` - manual indexers registered by a plugin are
 * untouched and keep working exactly as before.
 *
 * Two properties matter for review:
 *
 * 1. **Only published rows are read.** `publishedCondition` is not a parameter -
 *    both queries `and` it in themselves, so there is no argument a caller could
 *    forget, and it is the same SQL predicate the public read layer uses.
 * 2. **Only projected columns are read.** The `SELECT` is built from the
 *    configured search fields, all of which `defineContentType` has already
 *    proven are in `publicApi.fields`. A private column is never fetched, and
 *    column names are resolved into Drizzle columns rather than interpolated
 *    into SQL.
 */
export const createContentSearchIndexer = <
  TDefinition extends AnyContentTypeDefinition,
>(
  model: ContentModel<TDefinition>,
): SearchIndexer => {
  const { definition } = model;
  // Widened the same way `createContentPublicService` takes it: the query
  // builders are written against the erased table, not this content type's.
  const table: PgTableWithColumns<TableConfig> = model.table;
  const columns = model.columns as Record<string, PgColumn>;
  const published = publicationColumns(definition, columns);
  const primaryCursor = columns.id;

  const selection: Record<string, PgColumn> = Object.fromEntries(
    [
      ...new Set([
        ...REQUIRED_COLUMNS,
        ...contentSearchIndexedFieldNames(definition),
      ]),
    ].map(name => [name, columns[name]]),
  );

  return {
    itemType: definition.id,

    // Published rows, not every row: the AdminCP coverage bar compares this
    // against the number of indexed items, and counting drafts would pin a
    // mostly-unpublished collection at "stale" forever.
    count: async c => {
      const [row] = await c
        .get("db")
        .select({ value: count() })
        .from(table)
        .where(publishedCondition(published));

      return row?.value ?? 0;
    },

    // Offset paging, which is what the contract exposes. Ordering by the primary
    // key keeps pages from overlapping within one rebuild; a row whose
    // publication state changes mid-rebuild can still shift, and that is what
    // the next publish - or the next rebuild - repairs.
    load: async (c, offset, limit) => {
      const rows = await c
        .get("db")
        .select(selection)
        .from(table)
        .where(publishedCondition(published))
        .orderBy(asc(primaryCursor))
        .limit(limit)
        .offset(offset);

      return rows.flatMap(row => {
        const document = contentSearchDocument(definition, row);

        return document ? [document] : [];
      }) satisfies SearchDocument[];
    },
  };
};
