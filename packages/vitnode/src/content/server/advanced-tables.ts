import type {
  PgColumn,
  PgColumnBuilderBase,
  PgTable,
} from "drizzle-orm/pg-core";

import {
  index,
  integer,
  pgTable,
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

import { core_users } from "../../database/users";
import { ContentEngineError } from "../errors";
import {
  asContentReferenceCollection,
  contentInnerFields,
  contentStorageColumns,
} from "../paths";
import { buildContentColumn } from "./column-builders";

/**
 * Generates the relational storage Stage 6 needs.
 *
 * Two shapes, both ordinary Drizzle tables so `drizzle-kit` discovers them the
 * same way it discovers every other one - by runtime identity, when it globs the
 * plugin's built `dist/src/database/*.js`. There is no JSONB column, no
 * comma-separated identifier list and no property/value table anywhere in here:
 * a to-many relation is a junction table with two foreign keys, and a repeatable
 * is a child table with real columns, real constraints and real indexes.
 */

/**
 * The junction table for one to-many relation field.
 *
 * ```text
 * example_articles_categories
 *   itemId        -> example_articles.id     ON DELETE CASCADE
 *   relatedItemId -> example_categories.id   ON DELETE <configured>
 *   position      integer NOT NULL
 *   createdAt     timestamp NOT NULL DEFAULT now()
 *
 *   PRIMARY KEY (itemId, relatedItemId)
 *   UNIQUE      (itemId, position)
 *   INDEX       (relatedItemId)
 * ```
 *
 * `itemId` always cascades: the references *belong to* the source record, so
 * deleting it takes them in one statement rather than leaving rows pointing at
 * nothing. The other side takes the field's own `onDelete`, which is what makes
 * `restrict` mean "you cannot delete a category that is still in use" and have
 * Postgres be the thing that enforces it - not a check in service code that a
 * direct SQL delete would walk straight past.
 *
 * `position` is always stored, ordered relation or not, and is always contiguous
 * from zero. That is what lets one `UNIQUE (item_id, position)` serve both: an
 * ordered relation gets deterministic slots, and an unordered one gets a
 * deterministic *read* order (ascending target id, assigned at write time)
 * instead of whatever the planner felt like returning.
 */
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

  const columns: Record<string, PgColumnBuilderBase> = {
    itemId: integer()
      .notNull()
      .references(itemReference, { onDelete: "cascade", onUpdate: "cascade" }),
    relatedItemId: integer()
      .notNull()
      .references(relatedReference, { onDelete, onUpdate: "cascade" }),
    position: integer().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  };

  return pgTable(
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
  ).enableRLS() as unknown as ContentJunctionTable;
};

/**
 * The child table for one repeatable field.
 *
 * ```text
 * example_articles_faq
 *   id        serial PRIMARY KEY
 *   itemId    -> example_articles.id  ON DELETE CASCADE
 *   position  integer NOT NULL
 *   createdAt timestamp NOT NULL DEFAULT now()
 *   updatedAt timestamp NOT NULL DEFAULT now()
 *   question  varchar(200) NOT NULL
 *   answer    text NOT NULL
 *
 *   UNIQUE (itemId, position)
 * ```
 *
 * `id` is a `serial` of its own and **not** `(itemId, position)`. Position is
 * where a child currently sits; identity is what a later edit addresses and what
 * a revision restore matches an historical row against. Conflating the two would
 * make "update the third FAQ entry" mean a different row after every reorder,
 * and would make a restore recreate rows instead of putting values back.
 *
 * The unique index on `(itemId, position)` is what makes duplicate slots
 * impossible rather than merely unlikely; the writer avoids transient collisions
 * by replacing the whole list in one delete-then-insert inside the transaction
 * that already holds the source row's lock.
 */
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
  const columns: Record<string, PgColumnBuilderBase> = {
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

  return pgTable(
    tableName,
    () => columns,
    table => {
      const columnMap = table as unknown as Record<string, PgColumn>;

      return [
        uniqueIndex(positionIndexName).on(columnMap.itemId, columnMap.position),
      ];
    },
  ).enableRLS() as unknown as ContentRepeatableChildTable<unknown>;
};

/**
 * Every generated collection table of one content type.
 *
 * Driven by `definition.advanced`, which `defineContentType` has already
 * validated and named - so the table this creates and the table a migration
 * creates are the same table by construction rather than by coincidence.
 */
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

    // Three ways the far side of a junction is known, and only one of them is
    // the plugin's to supply:
    //
    // - a **user** collection points at `core_users`, which the engine owns;
    // - a **self**-relation resolves from the table being built (requiring it in
    //   `references` would mean writing `() => thisContent.table.id` inside the
    //   model's own initializer, which widens the whole model to `any`);
    // - everything else names its target table in `references`.
    const relatedReference: ColumnReferenceThunk | undefined =
      fieldValue.kind === "user"
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
      onDelete: fieldValue.onDelete,
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
