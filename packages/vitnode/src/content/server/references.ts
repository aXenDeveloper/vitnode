import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";

import { alias, getTableConfig } from "drizzle-orm/pg-core";

import type { AnyContentTypeDefinition } from "../types";

import { ContentEngineError } from "../errors";
import { isContentRelationCollection } from "../paths";

export interface ReferenceTarget {
  /** Aliased, so two relations pointing at the same table can both be joined. */
  aliased: PgTable;
  idColumn: PgColumn;
  labelColumn: PgColumn;
  owner: PgColumn;
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
    const labelName =
      fieldValue.kind === "user"
        ? "name"
        : (fieldValue.target().admin.titleField ?? "id");

    const aliased = alias(reference.foreignTable, `${LABEL_PREFIX}${name}`);
    const aliasedColumns = aliased as unknown as Record<string, PgColumn>;

    targets[name] = {
      aliased,
      idColumn: aliasedColumns.id,
      labelColumn: aliasedColumns[labelName] ?? aliasedColumns.id,
      owner: columns[name],
    };
  }

  return targets;
};
