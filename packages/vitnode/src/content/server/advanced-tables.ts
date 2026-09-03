import type {
  AnyPgColumnBuilder,
  PgColumn,
  PgTable,
} from "drizzle-orm/pg-core";

import {
  camelCase,
  index,
  integer,
  primaryKey,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  AnyContentTypeDefinition,
  ContentFieldMap,
  ContentOnDelete,
} from "../types";
import type { ColumnReferenceThunk } from "./column-builders";
import type {
  ContentAdvancedTables,
  ContentJunctionTable,
  ContentReferences,
  ContentRepeatableChildTable,
} from "./types";

import { core_files } from "../../database/files";
import { core_users } from "../../database/users";
import { ContentEngineError } from "../errors";
import {
  asContentReferenceCollection,
  contentInnerFields,
  contentStorageColumns,
} from "../paths";
import { buildContentColumn } from "./column-builders";

export const createContentJunctionTable = ({
  contentTypeId,
  field,
  itemReference,
  onDelete,
  positionIndexName,
  primaryKeyName,
  relatedIndexName,
  relatedReference,
  tableName,
}: {
  contentTypeId: string;
  field: string;
  itemReference: ColumnReferenceThunk;
  onDelete: ContentOnDelete;
  positionIndexName: string;
  primaryKeyName: string;
  relatedIndexName: string;
  relatedReference: ColumnReferenceThunk;
  tableName: string;
}): ContentJunctionTable => {
  if (onDelete === "set null") {
    throw new ContentEngineError(
      `Relation field "${field}" cannot be \`onDelete: "set null"\`: a junction row has no nullable column to set.`,
      { contentTypeId },
    );
  }

  const columns: Record<string, AnyPgColumnBuilder> = {
    itemId: integer()
      .notNull()
      .references(itemReference, { onDelete: "cascade", onUpdate: "cascade" }),
    relatedItemId: integer()
      .notNull()
      .references(relatedReference, { onDelete, onUpdate: "cascade" }),
    position: integer().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  };

  return camelCase.table.withRLS(
    tableName,
    () => columns,
    table => {
      const columnMap = table as unknown as Record<string, PgColumn>;

      return [
        // The identity of a reference *is* the pair, so a surrogate key would
        // make "one row per target" a constraint somebody could forget to add.
        primaryKey({
          columns: [columnMap.itemId, columnMap.relatedItemId],
          name: primaryKeyName,
        }),
        uniqueIndex(positionIndexName).on(columnMap.itemId, columnMap.position),
        // The primary key's B-tree can serve any prefix of `(itemId, ...)`, so
        // only the reverse direction needs its own index - which is also the one
        // an `ON DELETE RESTRICT` check on the target does.
        index(relatedIndexName).on(columnMap.relatedItemId),
      ];
    },
  ) as unknown as ContentJunctionTable;
};

export const createContentRepeatableTable = ({
  contentTypeId,
  fields,
  itemReference,
  positionIndexName,
  tableName,
}: {
  contentTypeId: string;
  fields: ContentFieldMap;
  itemReference: ColumnReferenceThunk;
  positionIndexName: string;
  tableName: string;
}): ContentRepeatableChildTable<unknown> => {
  const columns: Record<string, AnyPgColumnBuilder> = {
    id: serial().primaryKey(),
    itemId: integer()
      .notNull()
      .references(itemReference, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };

  for (const [name, fieldValue] of Object.entries(fields)) {
    columns[name] = buildContentColumn({ contentTypeId, fieldValue, name });
  }

  return camelCase.table.withRLS(
    tableName,
    () => columns,
    table => {
      const columnMap = table as unknown as Record<string, PgColumn>;

      return [
        uniqueIndex(positionIndexName).on(columnMap.itemId, columnMap.position),
      ];
    },
  ) as unknown as ContentRepeatableChildTable<unknown>;
};

export const createContentAdvancedTables = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  {
    references = {} as ContentReferences<TDefinition["fields"]>,
    table,
  }: {
    references?: ContentReferences<TDefinition["fields"]>;
    table: PgTable;
  },
): ContentAdvancedTables => {
  const { advanced, fields, id: contentTypeId } = definition;
  const baseColumns = table as unknown as Record<string, PgColumn>;
  const referenceThunks = references as Record<string, ColumnReferenceThunk>;
  const itemReference: ColumnReferenceThunk = () => baseColumns.id;

  const junctions: Record<string, ContentJunctionTable> = {};
  for (const entry of advanced.junctions) {
    const fieldValue = asContentReferenceCollection(fields[entry.field]);
    if (!fieldValue) continue;

    // Four ways the far side of a junction is known, and only one of them is
    // the plugin's to supply:
    //
    // - a **file** collection points at `core_files`, which the engine owns;
    // - a **user** collection points at `core_users`, likewise;
    // - a **self**-relation resolves from the table being built (requiring it in
    //   `references` would mean writing `() => thisContent.table.id` inside the
    //   model's own initializer, which widens the whole model to `any`);
    // - everything else names its target table in `references`.
    const relatedReference: ColumnReferenceThunk | undefined =
      fieldValue.kind === "file"
        ? () => core_files.id
        : fieldValue.kind === "user"
          ? () => core_users.id
          : fieldValue.self
            ? itemReference
            : referenceThunks[entry.field];
    if (!relatedReference) {
      throw new ContentEngineError(
        `To-many relation "${entry.field}" has no entry in \`references\`. Add \`${entry.field}: () => <target_table>.id\` - the junction table's foreign key needs a target just as much as a column would.`,
        { contentTypeId },
      );
    }

    junctions[entry.field] = createContentJunctionTable({
      contentTypeId,
      field: entry.field,
      itemReference,
      // A gallery entry is `restrict`, always, and not a per-field choice - the
      // same rule the single-file column follows. `cascade` would delete the
      // junction row because somebody tidied up the Files screen, silently
      // removing an image from a published gallery, and there is nothing here
      // for `set null` to null. Refusing the *file* deletion is the only outcome
      // that loses nothing, and it is what lets `StorageModel.deleteFile` answer
      // 409 instead of leaving a gallery pointing at bytes that are gone.
      onDelete: fieldValue.kind === "file" ? "restrict" : fieldValue.onDelete,
      positionIndexName: entry.positionIndexName,
      primaryKeyName: entry.primaryKeyName,
      relatedIndexName: entry.relatedIndexName,
      relatedReference,
      tableName: entry.tableName,
    });
  }

  const repeatables: Record<string, ContentRepeatableChildTable<unknown>> = {};
  for (const entry of advanced.repeatables) {
    repeatables[entry.field] = createContentRepeatableTable({
      contentTypeId,
      // Flattened for symmetry with the base table, though a repeatable's leaves
      // are all scalars already - `contentStorageColumns` is a no-op here and
      // stays in the path so a future nested leaf is a compile error rather than
      // a column that silently never appears.
      fields: contentStorageColumns(contentInnerFields(fields[entry.field])),
      itemReference,
      positionIndexName: entry.positionIndexName,
      tableName: entry.tableName,
    });
  }

  return { junctions, repeatables };
};

/** Column name -> Drizzle column on one generated collection table. */
export const contentCollectionTableColumns = (
  table: ContentJunctionTable | ContentRepeatableChildTable<unknown>,
): Record<string, PgColumn> => table as unknown as Record<string, PgColumn>;
