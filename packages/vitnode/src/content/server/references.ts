import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";

import { alias, getTableConfig } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition } from "../types";

import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import { isContentRelationCollection } from "../paths";
import { createContentTranslationTable } from "./translation-table";

/**
 * One aliased translation table of a relation target, and the three columns a
 * label is read through.
 *
 * Aliased per field *and* per role, because the same target may be joined twice
 * in one statement - once for the reader's language and once for the target's
 * default - and Postgres needs two names for that.
 */
export interface ReferenceTranslationSource {
  aliased: PgTable;
  itemColumn: PgColumn;
  labelColumn: PgColumn;
  languageColumn: PgColumn;
}

/**
 * How to read the label of a relation whose target's `admin.titleField` is
 * **localized** - `blog.category` with `name: field.text({ localized: true })`
 * and `titleField: "name"`.
 *
 * The value is not a column on the target's base table at all, so the numeric id
 * is all a plain join can produce. Two joins onto the target's translation table
 * produce the honest answer instead: the reader's own language, falling back to
 * the language the target is authored in.
 */
export interface ReferenceLocalizedLabel {
  /** The target's `localization.defaultLocale`. The fallback's language. */
  defaultLocale: string;
  fallback: ReferenceTranslationSource;
  viewer: ReferenceTranslationSource;
}

export interface ReferenceTarget {
  /** Aliased, so two relations pointing at the same table can both be joined. */
  aliased: PgTable;
  idColumn: PgColumn;
  /**
   * The label on the target's **base** table, or its id when the label lives on
   * the translation table.
   *
   * Read directly only when {@link ReferenceTarget.localizedLabel} is absent;
   * otherwise it is the last-resort value a row with no translation at all falls
   * back to.
   */
  labelColumn: PgColumn;
  /** Present when the target names a localized field as its `admin.titleField`. */
  localizedLabel?: ReferenceLocalizedLabel;
  owner: PgColumn;
  /**
   * The extra columns a **person** is recognised by, for a `user` field.
   *
   * Absent on a `relation`, whose target is a content type with no avatar and no
   * handle. Present, the picker shows a face and an `@name` instead of a bare
   * string - which is the whole difference between choosing a user and choosing
   * a row that happens to have a name.
   */
  userColumns?: { avatarColor: PgColumn; nameCode: PgColumn };
}

export const LABEL_PREFIX = "label__";

/**
 * Turns a joined label column value into display text. Only the shapes a title
 * column can actually hold are handled - anything else becomes `null` rather
 * than "[object Object]".
 */
export const toLabel = (value: unknown): null | string => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();

  return null;
};

/**
 * One target's translation table, built once for the life of the process.
 *
 * `resolveReferenceTargets` runs per request, and the table it needs is a pure
 * function of a definition that never changes - so it is memoised against the
 * definition rather than rebuilt on every list.
 */
const translationTables = new WeakMap<AnyContentTypeDefinition, PgTable>();

/**
 * The target's translation table, rebuilt from its own definition.
 *
 * Rebuilt rather than looked up because a relation target arrives here as a
 * `defineContentType` result - the thunk on the field - and never as a model:
 * `createContentModel` lives in the owning plugin's `src/database/*.ts`, which
 * the engine has no registry of at this point. The generated table is a pure
 * function of the definition and the base table, so this produces the same
 * columns, the same name and the same types as the model's own - and being a
 * second object costs nothing, since it is only ever aliased into a join.
 */
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

/**
 * Works out which table and column supply the display label for each
 * `user`/`relation` field.
 *
 * The target comes from the foreign keys Drizzle already resolved on the table,
 * so the engine needs no separate table registry - and because the FK thunk is
 * evaluated here, circular content type references stay safe.
 *
 * **Administrative only.** A label is read from the target's
 * `admin.titleField`, which is metadata for the AdminCP: it may name a field
 * the target never publishes, and the row it comes from may itself be a draft.
 * The public projection therefore does not use this at all - an exposed
 * relation there is `{ id }`, taken straight off the foreign key.
 */
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
    // A to-many relation has no foreign key *here*: its two are on the
    // generated junction table, and its picker resolves through
    // `model.advancedTables` rather than through a column on this row.
    if (isContentRelationCollection(fieldValue)) continue;

    const reference = byOwnerColumn.get(name);
    if (!reference) {
      throw new ContentEngineError(
        `Field "${name}" has no foreign key on "${definition.tableName}".`,
        { contentTypeId: definition.id },
      );
    }

    // `user` labels come from the core users table; a relation uses the target
    // content type's own `admin.titleField`.
    const targetDefinition =
      fieldValue.kind === "user" ? null : fieldValue.target();
    const labelName =
      targetDefinition === null
        ? "name"
        : (targetDefinition.admin.titleField ?? "id");

    const aliased = alias(reference.foreignTable, `${LABEL_PREFIX}${name}`);
    const aliasedColumns = aliased as unknown as Record<string, PgColumn>;

    // A title field the target declared `localized: true` is a column on its
    // translation table and on nothing else, so `aliasedColumns[labelName]`
    // above is `undefined` and a plain join can only ever produce the id.
    const localized =
      targetDefinition !== null &&
      targetDefinition.localization.enabled &&
      labelName in
        partitionContentFields(targetDefinition.fields).localizedFields
        ? targetDefinition
        : null;

    targets[name] = {
      aliased,
      idColumn: aliasedColumns.id,
      labelColumn: aliasedColumns[labelName] ?? aliasedColumns.id,
      ...(localized
        ? {
            localizedLabel: {
              defaultLocale: localized.localization.defaultLocale,
              fallback: translationSource(
                localized,
                reference.foreignTable,
                labelName,
                `${LABEL_PREFIX}${name}__default`,
              ),
              viewer: translationSource(
                localized,
                reference.foreignTable,
                labelName,
                `${LABEL_PREFIX}${name}__locale`,
              ),
            },
          }
        : {}),
      owner: columns[name],
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
  }

  return targets;
};
