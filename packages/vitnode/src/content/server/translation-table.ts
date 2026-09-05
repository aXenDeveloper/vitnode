import type {
  AnyPgColumnBuilder,
  PgColumn,
  PgTable,
} from "drizzle-orm/pg-core";

import { camelCase, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition, ResolvedContentIndex } from "../types";
import type {
  ContentTranslationColumnName,
  ContentTranslationTableFor,
} from "./types";

import { core_languages } from "../../database/languages";
import {
  CONTENT_TRANSLATION_PUBLICATION_FIELDS,
  CONTENT_TRANSLATION_SYSTEM_FIELDS,
} from "../const";
import { ContentEngineError } from "../errors";
import { contentTranslationPrimaryKeyName } from "../indexes";
import { partitionContentFields } from "../localization";
import { contentStorageColumns } from "../paths";
import {
  buildContentColumn,
  buildTranslationPublicationColumns,
  buildTranslationSystemColumns,
} from "./column-builders";

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

  // Flattened, so a localized group contributes its leaf columns here exactly
  // as a shared one does on the base table.
  const localizedFields = contentStorageColumns(
    partitionContentFields(definition.fields).localizedFields,
  );
  const baseColumns = table as unknown as Record<string, PgColumn>;

  const columns: Record<string, AnyPgColumnBuilder> = {
    ...buildTranslationSystemColumns({
      itemReference: () => baseColumns.id,
      languageReference: () => core_languages.id,
    }),
    // Only with publication, matching the base table exactly. Without a global
    // draft state there is nothing for a translation's own status to be
    // subordinate to, and the column would gate a visibility nothing consults.
    ...(definition.publication.enabled
      ? buildTranslationPublicationColumns()
      : {}),
  };

  for (const [name, fieldValue] of Object.entries(localizedFields)) {
    columns[name] = buildContentColumn({ contentTypeId, fieldValue, name });
  }

  const { translationIndexes, translationTableName } = localization;

  return camelCase.table.withRLS(
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
  ) as unknown as ContentTranslationTableFor<TDefinition>;
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
    ...(definition.publication.enabled
      ? CONTENT_TRANSLATION_PUBLICATION_FIELDS
      : []),
    ...Object.keys(contentStorageColumns(localizedFields)),
  ];

  return {
    ...Object.fromEntries(names.map(name => [name, source[name]])),
    // Canonical paths as aliases of the generated leaf columns, exactly as
    // `contentTableColumns` registers them for the base table - so a filter or a
    // search configured in paths resolves on either side of the join.
    ...Object.fromEntries(
      definition.advanced.leaves
        .filter(leaf => leaf.localized)
        .map(leaf => [leaf.path, source[leaf.columnName]]),
    ),
  } as Record<ContentTranslationColumnName<TDefinition>, PgColumn>;
};
