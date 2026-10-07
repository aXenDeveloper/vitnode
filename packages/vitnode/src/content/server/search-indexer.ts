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
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition, ContentFieldMap } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentModel } from "./model";

import { ContentEngineError } from "../errors";
import { contentIdKey, parseContentId } from "../ids";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentLeafColumnName,
  splitContentFieldPath,
} from "../paths";
import { contentSearchIndexedFieldNames } from "../search";
import { listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
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
 * {@link REQUIRED_COLUMNS}, plus `hiddenAt` for a content type with `visibility`:
 * a rebuild has to index a hidden record as private, exactly as the live hide
 * did, or every rebuild would put it back into public results.
 */
const requiredColumns = (definition: AnyContentTypeDefinition): string[] => [
  ...REQUIRED_COLUMNS,
  ...(definition.visibility.enabled ? ["hiddenAt"] : []),
];

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

const resolveSearchSources = (
  definition: AnyContentTypeDefinition,
): ContentSearchSources => {
  const { collectionFields, localizedFields, sharedFields } =
    partitionContentFields(definition.fields);
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

      if (collectionFields[name] !== undefined) {
        if (!sources.collections.includes(name)) sources.collections.push(name);
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
 * The indexed collections of one page, keyed by storage key so a row reads its
 * own back whatever its strategy.
 */
const loadSearchCollections = async ({
  advanced,
  c,
  definition,
  itemIds,
  wanted,
}: {
  advanced: ContentAdvancedStore;
  c: Context;
  definition: AnyContentTypeDefinition;
  itemIds: readonly unknown[];
  wanted: readonly string[];
}): Promise<Map<string, Record<string, unknown>>> => {
  if (wanted.length === 0) return new Map();

  const unique = new Map<string, ContentId>();
  for (const value of itemIds) {
    const id = parseContentId(definition.idStrategy, value);
    if (id !== null) unique.set(contentIdKey(id), id);
  }
  if (unique.size === 0) return new Map();

  const loaded = await advanced.loadMany(
    [...unique.values()],
    c.get("db"),
    wanted,
  );

  return new Map(
    [...loaded].map(([id, values]) => [contentIdKey(id), values] as const),
  );
};

/** The storage key of a row's own id, for reading a collection map. */
const rowKey = (row: Record<string, unknown>): string =>
  typeof row.id === "number" || typeof row.id === "string"
    ? contentIdKey(row.id)
    : "";

const assertPublicationColumns = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): void => {
  if (!definition.publication.enabled || !columns.status) {
    throw new ContentEngineError(
      "The search indexer needs `publication: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }
};

export interface ContentSearchIndexer extends SearchIndexer {
  load: (
    c: Context,
    offset: number,
    limit: number,
  ) => Promise<SearchIndexerPage>;
}

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
  assertPublicationColumns(definition, columns);
  const primaryCursor = columns.id;

  const sources = resolveSearchSources(definition);
  const advanced = model.advanced;
  const selection: Record<string, PgColumn> = Object.fromEntries(
    [
      ...new Set([...requiredColumns(definition), ...sources.sharedColumns]),
    ].map(name => [name, columns[name]]),
  );

  // The id strategy's own representation: a number for `serial`, a string for
  // `uuid` and string-mode `bigint` - never `Number(...)`, which would round a
  // bigint above 2^53 and lose the page boundary.
  const cursors = new WeakMap<Context, ContentId>();

  return {
    itemType: definition.id,

    // Every row, drafts included: a draft is indexed as a private document, and
    // the AdminCP coverage bar compares this against the number indexed.
    count: async c => {
      const [row] = await c.get("db").select({ value: count() }).from(table);

      return row?.value ?? 0;
    },

    load: async (c, offset, limit) => {
      // The contract's only signal that this is a fresh pass rather than the
      // next page of one.
      if (offset === 0) cursors.delete(c);
      const cursor = cursors.get(c);

      const rows = await c
        .get("db")
        .select(selection)
        .from(table)
        .where(cursor === undefined ? undefined : gt(primaryCursor, cursor))
        .orderBy(asc(primaryCursor))
        .limit(limit);

      const last = rows.at(-1);
      const lastId = last
        ? parseContentId(definition.idStrategy, last.id)
        : null;
      if (lastId !== null) cursors.set(c, lastId);

      // One batch for the whole page, and only the collections the search
      // configuration names - never one query per document.
      const collections = await loadSearchCollections({
        advanced,
        c,
        definition,
        itemIds: rows.map(row => (row as Record<string, unknown>).id),
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
            ...collections.get(rowKey(values)),
          },
          { pluginId, routing: contentLocaleRouting(c) },
        );

        return document ? [document] : [];
      }) satisfies SearchDocument[];

      return { documents, itemsRead: rows.length };
    },
  };
};

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
  assertPublicationColumns(definition, columns);

  const sources = resolveSearchSources(definition);
  const advanced = model.advanced;
  const sharedSelection = [
    ...new Set([...requiredColumns(definition), ...sources.sharedColumns]),
  ];
  const localizedSelection = [...new Set(sources.localizedColumns)];

  const cursors = new WeakMap<
    Context,
    { itemId: ContentId; languageId: number }
  >();

  return {
    itemType: definition.id,

    // Translations, not records: the coverage bar compares this against the
    // number of indexed documents, and a record counts once per language it has,
    // drafts included.
    count: async c => {
      const [row] = await c
        .get("db")
        .select({ value: count() })
        .from(translationTable)
        .innerJoin(table, eq(rows.itemId, columns.id));

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
            ? undefined
            : or(
                gt(columns.id, cursor.itemId),
                and(
                  eq(columns.id, cursor.itemId),
                  gt(rows.languageId, cursor.languageId),
                ),
              ),
        )
        .orderBy(asc(columns.id), asc(rows.languageId))
        .limit(limit);

      const last = page.at(-1) as Record<string, unknown> | undefined;
      const lastId = last
        ? parseContentId(definition.idStrategy, last.id)
        : null;
      if (last && lastId !== null) {
        cursors.set(c, {
          itemId: lastId,
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
        definition,
        itemIds: page.map(row => (row as Record<string, unknown>).id),
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
              ...collections.get(rowKey(values)),
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
          { pluginId, routing: contentLocaleRouting(c) },
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
