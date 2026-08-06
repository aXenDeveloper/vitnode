import type {
  PgColumn,
  PgColumnBuilderBase,
  PgTable,
} from "drizzle-orm/pg-core";

import { index, pgTable, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition, ResolvedContentIndex } from "../types";
import type {
  ContentTranslationColumnName,
  ContentTranslationTableFor,
} from "./types";

import { core_languages } from "../../database/languages";
import { CONTENT_TRANSLATION_SYSTEM_FIELDS } from "../const";
import { ContentEngineError } from "../errors";
import { contentTranslationPrimaryKeyName } from "../indexes";
import { partitionContentFields } from "../localization";
import {
  buildContentColumn,
  buildTranslationSystemColumns,
} from "./column-builders";

/**
 * Builds the `pgTable` holding one localized content type's translations.
 *
 * One table per content type, not one shared table for the whole install. That
 * is the entire design decision, and everything good about it follows from it:
 * real column types, real `NOT NULL`, a real unique index on `(languageId, slug)`,
 * Drizzle inference that knows what `title` is, and a migration `drizzle-kit`
 * generates rather than a JSONB blob or an EAV table nobody can index.
 *
 * Like {@link createContentTable} the result is an ordinary Drizzle table, so
 * `drizzle-kit` discovers it by runtime identity when it globs the plugin's built
 * `dist/src/database/*.js`. Export it from the plugin's database module:
 *
 * ```ts
 * export const example_articles_translations = articleContent.translationTable;
 * ```
 */
export const createContentTranslationTable = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  { table }: { table: PgTable },
): ContentTranslationTableFor<TDefinition> => {
  const { id: contentTypeId, localization } = definition;

  if (!localization.enabled) {
    throw new ContentEngineError(
      "createContentTranslationTable needs `localization: { enabled: true, defaultLocale }` on the content type.",
      { contentTypeId },
    );
  }

  const { localizedFields } = partitionContentFields(definition.fields);
  const baseColumns = table as unknown as Record<string, PgColumn>;

  const columns: Record<string, PgColumnBuilderBase> = {
    ...buildTranslationSystemColumns({
      itemReference: () => baseColumns.id,
      languageReference: () => core_languages.id,
    }),
  };

  for (const [name, fieldValue] of Object.entries(localizedFields)) {
    columns[name] = buildContentColumn({ contentTypeId, fieldValue, name });
  }

  const { translationIndexes, translationTableName } = localization;

  return pgTable(
    translationTableName,
    () => columns,
    translationTable => {
      const columnMap = translationTable as unknown as Record<string, PgColumn>;

      return [
        // `(itemId, languageId)` rather than a surrogate key: the identity of a
        // translation *is* the record plus the language, and a serial id would
        // make "one translation per locale" a constraint somebody could forget.
        primaryKey({
          columns: [columnMap.itemId, columnMap.languageId],
          name: contentTranslationPrimaryKeyName(translationTableName),
        }),
        ...translationIndexes.map((config: ResolvedContentIndex) => {
          const [first, ...rest] = config.on.map(name => columnMap[name]);

          return config.unique
            ? uniqueIndex(config.name).on(first, ...rest)
            : index(config.name).on(first, ...rest);
        }),
      ];
    },
  ).enableRLS() as unknown as ContentTranslationTableFor<TDefinition>;
};

/** Column name -> Drizzle column on the translation table. */
export const contentTranslationTableColumns = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  translationTable: ContentTranslationTableFor<TDefinition>,
): Record<ContentTranslationColumnName<TDefinition>, PgColumn> => {
  const source = translationTable as unknown as Record<string, PgColumn>;
  const { localizedFields } = partitionContentFields(definition.fields);
  const names = [
    ...CONTENT_TRANSLATION_SYSTEM_FIELDS,
    ...Object.keys(localizedFields),
  ];

  return Object.fromEntries(names.map(name => [name, source[name]])) as Record<
    ContentTranslationColumnName<TDefinition>,
    PgColumn
  >;
};
