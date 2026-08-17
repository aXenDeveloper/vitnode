import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, count, eq, gt, or } from "drizzle-orm";

import type {
  SearchDocument,
  SearchIndexer,
  SearchIndexerPage,
} from "../../api/models/search";
import type { AnyContentTypeDefinition, ContentFieldMap } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentModel } from "./model";

import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentLeafColumnName,
  splitContentFieldPath,
} from "../paths";
import { contentSearchIndexedFieldNames } from "../search";
import { listContentLanguages } from "./language-resolver";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";
import {
  contentSearchDocument,
  contentTranslationSearchDocument,
} from "./search-document";

/** System columns the mapper reads, on top of the configured search fields. */
const REQUIRED_COLUMNS = [
  "id",
  "createdAt",
  "updatedAt",
  "status",
  "publishedAt",
] as const;

/**
 * Where each indexed value comes from.
 *
 * A rebuild cannot classify a search field by looking it up in the top-level
 * field maps: `seo.description` is not a key in either of them, and
 * `faq.question` is not a column at all. Resolving the paths once - here - is
 * what lets both indexers select real columns, fold groups back into their
 * logical shape, and batch the collections they actually need.
 */
interface ContentSearchSources {
  /** Collection fields to batch-load for the page's parent ids. */
  collections: string[];
  /** Column names to select from the translation table. */
  localizedColumns: string[];
  /** Localized group descriptors, for folding translation columns back. */
  localizedGroups: ContentFieldMap;
  /** Column names to select from the base table. */
  sharedColumns: string[];
  /** Shared group descriptors, for folding base columns back. */
  sharedGroups: ContentFieldMap;
}

/**
 * Splits the configured search fields by where their values actually live.
 *
 * Three destinations, and a path is the only way to tell two of them apart:
 *
 * - a **scalar** field is a column, on whichever table its `localized` flag says;
 * - a **group leaf** is a column too, under its generated name, on the table the
 *   *group* moved to - localization is a property of the group, so one leaf can
 *   never be on the other side from its siblings;
 * - a **collection leaf** is not a column anywhere. Its parent is batch-loaded.
 */
const resolveSearchSources = (
  definition: AnyContentTypeDefinition,
): ContentSearchSources => {
  const { localizedFields, sharedFields } = partitionContentFields(
    definition.fields,
  );
  const sources: ContentSearchSources = {
    collections: [],
    localizedColumns: [],
    localizedGroups: {},
    sharedColumns: [],
    sharedGroups: {},
  };

  for (const name of contentSearchIndexedFieldNames(definition)) {
    const path = splitContentFieldPath(name);

    if (!path) {
      if (localizedFields[name] !== undefined) {
        sources.localizedColumns.push(name);
        continue;
      }
      if (sharedFields[name] !== undefined) sources.sharedColumns.push(name);
      continue;
    }

    const [owner, leaf] = path;
    const container = definition.fields[owner];
    if (!container) continue;

    if (container.kind !== "group") {
      // A repeatable or a to-many relation: its rows are on their own table, so
      // the parent is loaded whole rather than projected into this SELECT.
      if (!sources.collections.includes(owner)) sources.collections.push(owner);
      continue;
    }

    const column = contentLeafColumnName(owner, leaf);
    if (localizedFields[owner] !== undefined) {
      sources.localizedColumns.push(column);
      sources.localizedGroups[owner] = container;
      continue;
    }

    sources.sharedColumns.push(column);
    sources.sharedGroups[owner] = container;
  }

  return sources;
};

/**
 * The shared collections for one rebuild page, in one batch per field.
 *
 * Keyed by parent id and deduplicated first, which is what makes the localized
 * rebuild safe: a record with three published translations appears three times on
 * a page, and loading its FAQ once rather than three times is the difference
 * between a bounded query count and an N+1.
 */
const loadSearchCollections = async ({
  advanced,
  c,
  itemIds,
  wanted,
}: {
  advanced: ContentAdvancedStore;
  c: Context;
  itemIds: readonly number[];
  wanted: readonly string[];
}): Promise<Map<number, Record<string, unknown>>> => {
  if (wanted.length === 0) return new Map();

  const unique = [...new Set(itemIds.filter(id => Number.isInteger(id)))];
  if (unique.length === 0) return new Map();

  return await advanced.loadMany(unique, c.get("db"), wanted);
};

/**
 * A generated indexer, pinned to the modern page contract.
 *
 * `SearchIndexer.load` also accepts the deprecated bare-array result, for
 * hand-written indexers that predate it. A generated one never returns that, and
 * saying so keeps the guarantee in the type rather than in a comment.
 */
export interface ContentSearchIndexer extends SearchIndexer {
  load: (
    c: Context,
    offset: number,
    limit: number,
  ) => Promise<SearchIndexerPage>;
}

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
  { pluginId }: { pluginId: string },
): ContentSearchIndexer => {
  const { definition } = model;
  // Widened the same way `createContentPublicService` takes it: the query
  // builders are written against the erased table, not this content type's.
  const table: PgTableWithColumns<TableConfig> = model.table;
  const columns = model.columns as Record<string, PgColumn>;
  const published = publicationColumns(definition, columns);
  const primaryCursor = columns.id;

  const sources = resolveSearchSources(definition);
  const advanced = model.advanced;
  const selection: Record<string, PgColumn> = Object.fromEntries(
    [...new Set([...REQUIRED_COLUMNS, ...sources.sharedColumns])].map(name => [
      name,
      columns[name],
    ]),
  );

  /**
   * The keyset cursor, per request.
   *
   * A `WeakMap` keyed by the Hono context, exactly as the localized indexer
   * does: the rebuild task calls `load` repeatedly within one request, and the
   * entry is collected with it. A fresh request starts at the beginning, which
   * is what a rebuild means.
   */
  const cursors = new WeakMap<Context, number>();

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

    /**
     * Keyset paging on `id`, not `OFFSET`.
     *
     * `OFFSET` was wrong twice over. It re-reads and discards every earlier row,
     * so page 500 of a rebuild costs five hundred pages of work - and worse, the
     * offset counts rows in a set that is *moving*: a record unpublished after
     * page one shifts everything behind it forward by one, and the next
     * `OFFSET 100` steps straight over a row nobody ever indexed. A rebuild that
     * silently misses rows is the failure a rebuild exists to fix.
     *
     * `WHERE id > :last` has neither problem. It seeks on the primary key, and
     * it is anchored to a value rather than to a position, so rows appearing or
     * disappearing behind the cursor cannot move it.
     *
     * The `offset` argument stays in the signature because the
     * {@link SearchIndexer} contract is shared with hand-written indexers; it is
     * used only as the "this is a fresh pass" signal, exactly as the localized
     * indexer uses it.
     *
     * `itemsRead` is the row count, not the document count. A published row with
     * no usable title projects to nothing, and reporting that as "no items"
     * would end the rebuild before the valid rows after it.
     */
    load: async (c, offset, limit) => {
      // The contract's only signal that this is a fresh pass rather than the
      // next page of one.
      if (offset === 0) cursors.delete(c);
      const cursor = cursors.get(c);

      const rows = await c
        .get("db")
        .select(selection)
        .from(table)
        .where(
          cursor === undefined
            ? publishedCondition(published)
            : and(publishedCondition(published), gt(primaryCursor, cursor)),
        )
        .orderBy(asc(primaryCursor))
        .limit(limit);

      const last = rows.at(-1);
      if (last && typeof last.id === "number") cursors.set(c, last.id);

      // One batch for the whole page, and only the collections the search
      // configuration names - never one query per document.
      const collections = await loadSearchCollections({
        advanced,
        c,
        itemIds: rows.map(row => Number((row as Record<string, unknown>).id)),
        wanted: sources.collections,
      });

      const documents = rows.flatMap(row => {
        const values = row as Record<string, unknown>;
        const document = contentSearchDocument(
          definition,
          {
            ...values,
            // Folded back into the nested logical shape the document builder
            // reads: it is handed `seo.description`, and a flat `seoDescription`
            // column would resolve to nothing.
            ...contentColumnsToValues(sources.sharedGroups, values),
            ...collections.get(Number(values.id)),
          },
          { pluginId },
        );

        return document ? [document] : [];
      }) satisfies SearchDocument[];

      return { documents, itemsRead: rows.length };
    },
  };
};

/**
 * The localized rebuild: one document per **published translation**.
 *
 * Two things make it a different function rather than a flag on the one above:
 *
 * 1. **The unit of paging is a translation, not a record.** `itemsRead` has to
 *    count translation rows, or a record with three languages would advance the
 *    offset by one and the rebuild would read it again forever.
 * 2. **Paging is keyset, not offset.** The cursor is `(itemId, languageId)`,
 *    which is the translation table's primary key, so a page can neither overlap
 *    nor skip while rows are being published underneath it - and Postgres seeks
 *    to it on the index rather than counting past every earlier row, which is
 *    what makes a rebuild of a large table finish in linear time.
 *
 * The `offset` the contract hands in is used only as a *position counter*: the
 * cursor is derived from the previous page's last row and kept here, keyed by
 * the request, so the contract stays unchanged for every existing indexer.
 *
 * Both halves of the visibility rule are in the query: the base row's published
 * predicate and the translation's. A translation of a draft record is not read,
 * so it can never be indexed.
 */
export const createContentLocalizedSearchIndexer = <
  TDefinition extends AnyContentTypeDefinition,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: string },
): ContentSearchIndexer => {
  const { definition } = model;
  const table: PgTableWithColumns<TableConfig> = model.table;
  const translationTable: null | PgTable = model.translationTable;
  const columns = model.columns as Record<string, PgColumn>;
  const translationColumns: null | Record<string, PgColumn> =
    model.translationColumns;

  if (!translationTable || !translationColumns) {
    throw new ContentEngineError(
      "The localized search indexer needs `localization: { enabled: true, defaultLocale }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  const rows = translationColumns;
  const base = publicationColumns(definition, columns);
  const translation = contentTranslationPublicationColumns(
    definition,
    translationColumns,
  );

  const sources = resolveSearchSources(definition);
  const advanced = model.advanced;
  const sharedSelection = [
    ...new Set([...REQUIRED_COLUMNS, ...sources.sharedColumns]),
  ];
  const localizedSelection = [...new Set(sources.localizedColumns)];

  const visible = (): SQL | undefined =>
    and(publishedCondition(base), publishedCondition(translation));

  /**
   * The keyset cursor, per request.
   *
   * A `WeakMap` keyed by the Hono context, for the same reason the language
   * registry uses one: the rebuild task calls `load` repeatedly within one
   * request, and the entry is collected with it. A fresh request starts at the
   * beginning, which is what a rebuild means.
   */
  const cursors = new WeakMap<
    Context,
    { itemId: number; languageId: number }
  >();

  return {
    itemType: definition.id,

    // Published *translations*, not published records: the coverage bar compares
    // this against the number of indexed documents, and a record counts once per
    // language it is actually readable in.
    count: async c => {
      const [row] = await c
        .get("db")
        .select({ value: count() })
        .from(translationTable)
        .innerJoin(table, eq(rows.itemId, columns.id))
        .where(visible());

      return row?.value ?? 0;
    },

    load: async (c, offset, limit) => {
      // `offset === 0` is the start of a rebuild - the contract's only signal
      // that this is a fresh pass rather than the next page of one.
      if (offset === 0) cursors.delete(c);
      const cursor = cursors.get(c);

      const page = await c
        .get("db")
        .select({
          ...Object.fromEntries(
            sharedSelection.map(name => [name, columns[name]]),
          ),
          _languageId: rows.languageId,
          _publishedAt: rows.publishedAt,
          _status: rows.status,
          _updatedAt: rows.updatedAt,
          ...Object.fromEntries(
            localizedSelection.map(name => [`t_${name}`, rows[name]]),
          ),
        })
        .from(translationTable)
        .innerJoin(table, eq(rows.itemId, columns.id))
        .where(
          cursor === undefined
            ? visible()
            : and(
                visible(),
                or(
                  gt(columns.id, cursor.itemId),
                  and(
                    eq(columns.id, cursor.itemId),
                    gt(rows.languageId, cursor.languageId),
                  ),
                ),
              ),
        )
        .orderBy(asc(columns.id), asc(rows.languageId))
        .limit(limit);

      const last = page.at(-1) as Record<string, unknown> | undefined;
      if (last) {
        cursors.set(c, {
          itemId: last.id as number,
          languageId: last._languageId as number,
        });
      }

      const languages = await listContentLanguages(c);
      const localeOf = new Map(
        languages.map(language => [language.id, language.locale]),
      );

      // Deduplicated across locales: a collection is shared, so three
      // translations of one record reuse one loaded value rather than issuing
      // three identical child queries.
      const collections = await loadSearchCollections({
        advanced,
        c,
        itemIds: page.map(row => Number((row as Record<string, unknown>).id)),
        wanted: sources.collections,
      });

      const documents = page.flatMap(row => {
        const values = row as Record<string, unknown>;
        const locale = localeOf.get(values._languageId as number);
        // A translation whose language row has been deleted has no locale to
        // index under. Skipped rather than guessed - a document under an invented
        // code is one nothing would ever query.
        if (locale === undefined) return [];

        const translationColumnValues = Object.fromEntries(
          localizedSelection.map(name => [name, values[`t_${name}`]]),
        );

        const document = contentTranslationSearchDocument(
          definition,
          {
            base: {
              ...values,
              ...contentColumnsToValues(sources.sharedGroups, values),
              ...collections.get(Number(values.id)),
            },
            locale,
            translation: {
              publishedAt: values._publishedAt,
              status: values._status,
              updatedAt: values._updatedAt,
              ...translationColumnValues,
              // Localized groups fold from the translation's own columns, so a
              // localized `seo.description` reads from the language being built
              // rather than from the base row.
              ...contentColumnsToValues(
                sources.localizedGroups,
                translationColumnValues,
              ),
            },
          },
          { pluginId },
        );

        return document ? [document] : [];
      }) satisfies SearchDocument[];

      // Translation rows, not documents: a published translation with no usable
      // title projects to nothing, and reporting that as "no items" would end the
      // rebuild before the rows behind it.
      return { documents, itemsRead: page.length };
    },
  };
};
