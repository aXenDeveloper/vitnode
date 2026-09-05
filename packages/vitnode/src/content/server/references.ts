import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";

import { alias, getTableConfig } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition, ContentReferenceField } from "../types";

import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import { isContentReferenceCollection } from "../paths";
import { createContentTranslationTable } from "./translation-table";

export interface ReferenceTranslationSource {
  aliased: PgTable;
  itemColumn: PgColumn;
  labelColumn: PgColumn;
  languageColumn: PgColumn;
}

export interface ReferenceLocalizedLabel {
  /** The target's `localization.defaultLocale`. The fallback's language. */
  defaultLocale: string;
  fallback: ReferenceTranslationSource;
  viewer: ReferenceTranslationSource;
}

export interface ContentPickerTarget {
  /** Aliased, so two relations pointing at the same table can both be joined. */
  aliased: PgTable;

  colorColumn?: PgColumn;
  idColumn: PgColumn;

  labelColumn: PgColumn;
  /** Present when the target names a localized field as its `admin.titleField`. */
  localizedLabel?: ReferenceLocalizedLabel;

  userColumns?: { avatarColor: PgColumn; nameCode: PgColumn };
}

/** A to-one reference: a picker target plus the column that points at it. */
export interface ReferenceTarget extends ContentPickerTarget {
  owner: PgColumn;
}

export const LABEL_PREFIX = "label__";

export const toLabel = (value: unknown): null | string => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();

  return null;
};

const translationTables = new WeakMap<AnyContentTypeDefinition, PgTable>();

const translationSource = (
  definition: AnyContentTypeDefinition,
  baseTable: PgTable,
  labelName: string,
  aliasName: string,
): ReferenceTranslationSource => {
  const cached = translationTables.get(definition);
  const translationTable =
    cached ??
    createContentTranslationTable(definition, {
      table: baseTable,
    });
  if (!cached) translationTables.set(definition, translationTable);

  const aliased = alias(translationTable, aliasName);
  const columns = aliased as unknown as Record<string, PgColumn>;

  return {
    aliased,
    itemColumn: columns.itemId,
    labelColumn: columns[labelName],
    languageColumn: columns.languageId,
  };
};

export const resolveReferenceTargets = (
  definition: AnyContentTypeDefinition,
  table: PgTableWithColumns<TableConfig>,
  columns: Record<string, PgColumn>,
): Record<string, ReferenceTarget> => {
  const fields = definition.fields;
  const byOwnerColumn = new Map(
    getTableConfig(table)
      .foreignKeys.map(foreignKey => foreignKey.reference())
      .map(reference => [reference.columns[0]?.name, reference]),
  );

  const targets: Record<string, ReferenceTarget> = {};

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "relation" && fieldValue.kind !== "user") continue;
    // A to-many reference has no foreign key *here*: its two are on the
    // generated junction table, so it is resolved by
    // {@link resolveCollectionPickerTargets} instead.
    if (isContentReferenceCollection(fieldValue)) continue;

    const reference = byOwnerColumn.get(name);
    if (!reference) {
      throw new ContentEngineError(
        `Field "${name}" has no foreign key on "${definition.tableName}".`,
        { contentTypeId: definition.id },
      );
    }

    targets[name] = {
      ...buildPickerTarget(name, fieldValue, reference.foreignTable),
      owner: columns[name],
    };
  }

  return targets;
};

export const resolveCollectionPickerTargets = (
  definition: AnyContentTypeDefinition,
  targetTableOf: (field: string) => null | PgTable,
): Record<string, ContentPickerTarget> => {
  const targets: Record<string, ContentPickerTarget> = {};

  for (const [name, fieldValue] of Object.entries(definition.fields)) {
    if (!isContentReferenceCollection(fieldValue)) continue;
    if (fieldValue.kind !== "relation" && fieldValue.kind !== "user") continue;

    const targetTable = targetTableOf(name);
    // Nothing to picker with, and nothing to fail over: a collection whose
    // junction has not resolved is one the form will simply offer no options
    // for, which the route reports as an empty list rather than a 500.
    if (!targetTable) continue;

    targets[name] = buildPickerTarget(name, fieldValue, targetTable);
  }

  return targets;
};

/** The label plumbing for one reference field, whatever points at the target. */
const buildPickerTarget = (
  name: string,
  fieldValue: ContentReferenceField,
  foreignTable: PgTable,
): ContentPickerTarget => {
  // `user` labels come from the core users table; a relation uses the target
  // content type's own `admin.titleField`.
  const targetDefinition =
    fieldValue.kind === "user" ? null : fieldValue.target();
  const labelName =
    targetDefinition === null
      ? "name"
      : (targetDefinition.admin.titleField ?? "id");

  const aliased = alias(foreignTable, `${LABEL_PREFIX}${name}`);
  const aliasedColumns = aliased as unknown as Record<string, PgColumn>;

  // A title field the target declared `localized: true` is a column on its
  // translation table and on nothing else, so `aliasedColumns[labelName]`
  // above is `undefined` and a plain join can only ever produce the id.
  const localized =
    targetDefinition !== null &&
    targetDefinition.localization.enabled &&
    labelName in partitionContentFields(targetDefinition.fields).localizedFields
      ? targetDefinition
      : null;

  const colorName = targetDefinition?.admin.colorField ?? null;

  return {
    aliased,
    idColumn: aliasedColumns.id,
    labelColumn: aliasedColumns[labelName] ?? aliasedColumns.id,
    ...(colorName !== null && aliasedColumns[colorName]
      ? { colorColumn: aliasedColumns[colorName] }
      : {}),
    ...(localized
      ? {
          localizedLabel: {
            defaultLocale: localized.localization.defaultLocale,
            fallback: translationSource(
              localized,
              foreignTable,
              labelName,
              `${LABEL_PREFIX}${name}__default`,
            ),
            viewer: translationSource(
              localized,
              foreignTable,
              labelName,
              `${LABEL_PREFIX}${name}__locale`,
            ),
          },
        }
      : {}),
    // Read off the alias rather than off `core_users` directly: the join is
    // already aliased per field, and selecting the unaliased column would
    // reference a table this query never named.
    ...(fieldValue.kind === "user" &&
    aliasedColumns.avatarColor &&
    aliasedColumns.nameCode
      ? {
          userColumns: {
            avatarColor: aliasedColumns.avatarColor,
            nameCode: aliasedColumns.nameCode,
          },
        }
      : {}),
  };
};
