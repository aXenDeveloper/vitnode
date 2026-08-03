import type {
  PgColumn,
  PgColumnBuilderBase,
  PgTable,
} from "drizzle-orm/pg-core";

import { getTableName } from "drizzle-orm";
import {
  getTableConfig,
  index,
  pgTable,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  AnyContentTypeDefinition,
  ContentFieldMap,
  ResolvedContentIndex,
} from "../types";
import type { ColumnReferenceThunk } from "./column-builders";
import type {
  ContentColumnName,
  ContentReferences,
  ContentTableFor,
} from "./types";

import { core_users } from "../../database/users";
import { CONTENT_PUBLICATION_FIELDS } from "../const";
import { ContentEngineError } from "../errors";
import {
  buildContentColumn,
  buildPublicationColumns,
  buildSystemColumns,
} from "./column-builders";

/**
 * Wraps a foreign-key thunk so the table it actually points at is checked
 * against the one the descriptor promised.
 *
 * A `relation` carries its target twice - `field.relation({ target })` in the
 * client-safe descriptor, and `references: { field: () => table.id }` in the
 * database module - and nothing else stops the two from drifting apart. The
 * check reads Drizzle's own table metadata rather than parsing SQL, and it
 * stays *inside* the thunk on purpose: evaluating either side eagerly would
 * break the circular imports the thunks exist to solve.
 */
const checkedReference = (
  contentTypeId: string,
  name: string,
  expectedTableName: () => string,
  thunk: ColumnReferenceThunk,
): ColumnReferenceThunk => {
  return () => {
    const column = thunk();
    if (!column?.table) {
      throw new ContentEngineError(
        `\`references.${name}\` resolved to nothing. Rebuild the plugin (\`build:plugins\`), and make sure the target table is exported from its \`src/database\` module.`,
        { contentTypeId },
      );
    }

    const actual = getTableName(column.table);
    const expected = expectedTableName();

    if (actual !== expected) {
      throw new ContentEngineError(
        `Relation field "${name}" targets "${expected}", but \`references.${name}\` points at "${actual}". Make both sides agree.`,
        { contentTypeId },
      );
    }

    return column;
  };
};

const resolveReference = (
  contentTypeId: string,
  name: string,
  fields: ContentFieldMap,
  references: Record<string, ColumnReferenceThunk>,
): ColumnReferenceThunk | undefined => {
  const fieldValue = fields[name];

  if (fieldValue.kind === "user") {
    return checkedReference(
      contentTypeId,
      name,
      () => getTableName(core_users),
      () => core_users.id,
    );
  }
  if (fieldValue.kind !== "relation") return undefined;

  const thunk = references[name];
  if (!thunk) {
    throw new ContentEngineError(
      `Relation field "${name}" has no entry in \`references\`. Add \`${name}: () => <target_table>.id\`.`,
      { contentTypeId },
    );
  }

  return checkedReference(
    contentTypeId,
    name,
    () => fieldValue.target().tableName,
    thunk,
  );
};

/**
 * Builds the `pgTable` for a content type.
 *
 * The result is an ordinary Drizzle table: `drizzle-kit` discovers it by
 * runtime identity (`is(value, PgTable)`) when it globs the plugin's built
 * `dist/src/database/*.js`, so migrations stay generated and source-controlled
 * exactly as they are for hand-written tables.
 *
 * Do not import this module from a client component - and do not add
 * `server-only` to it either: its `default` export throws under plain Node,
 * which both `apps/api` and `drizzle-kit` are.
 */
export const createContentTable = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  {
    references = {} as ContentReferences<TDefinition["fields"]>,
  }: {
    references?: ContentReferences<TDefinition["fields"]>;
  } = {},
): ContentTableFor<TDefinition> => {
  // Almost always a half-written `dist`: the plugin's watcher emitted
  // `src/database/*.js` before the `src/content/*.js` it imports, so the
  // definition binding is still empty. A circular import between the two would
  // look the same. Either way, the raw `TypeError` from destructuring is not a
  // useful thing to read at four in the afternoon.
  if ((definition as unknown) === undefined) {
    throw new ContentEngineError(
      "createContentModel was called with no definition. Rebuild the plugin (`build:plugins`); if that does not help, check for a circular import between `src/database` and `src/content`.",
    );
  }

  const { id: contentTypeId, indexes, tableName } = definition;
  const fields = definition.fields;
  const referenceThunks = references as Record<string, ColumnReferenceThunk>;

  const columns: Record<string, PgColumnBuilderBase> = {
    ...buildSystemColumns(),
    ...(definition.publication.enabled ? buildPublicationColumns() : {}),
  };

  for (const name of Object.keys(fields)) {
    columns[name] = buildContentColumn({
      contentTypeId,
      fieldValue: fields[name],
      name,
      reference: resolveReference(contentTypeId, name, fields, referenceThunks),
    });
  }

  const unknownReference = Object.keys(referenceThunks).find(
    name => fields[name]?.kind !== "relation",
  );
  if (unknownReference !== undefined) {
    throw new ContentEngineError(
      `\`references\` has an entry for "${unknownReference}", which is not a relation field.`,
      { contentTypeId },
    );
  }

  // `definition.indexes` is already the complete, deduplicated, named set -
  // declared indexes, field-level uniques, foreign keys and the timestamps that
  // back the default ordering. Nothing is invented here.
  const buildIndexes = (columnMap: Record<string, PgColumn>) =>
    indexes.map((config: ResolvedContentIndex) => {
      const [first, ...rest] = config.on.map(name => columnMap[name]);

      return config.unique
        ? uniqueIndex(config.name).on(first, ...rest)
        : index(config.name).on(first, ...rest);
    });

  // `pgTable` erases the per-key builder types once the column map is assembled
  // in a loop, so the descriptor-derived `ContentTableFor` is re-attached here.
  // It is built from Drizzle's own `BuildColumns`, so `$inferSelect` and
  // `$inferInsert` stay accurate - see `table.test-d.ts`.
  return pgTable(
    tableName,
    () => columns,
    table => buildIndexes(table as unknown as Record<string, PgColumn>),
  ).enableRLS() as unknown as ContentTableFor<TDefinition>;
};

/**
 * Forces every foreign key on the table to resolve.
 *
 * Drizzle keeps a foreign key as an unevaluated thunk until it serializes the
 * table, which is what lets two content types reference each other. Calling
 * this once from `buildContentAdminModule` - after every `src/database/*.ts`
 * has finished loading - turns a target mismatch into a boot-time failure
 * rather than a surprise on the first request.
 */
export const assertContentReferences = (table: PgTable): void => {
  for (const foreignKey of getTableConfig(table).foreignKeys) {
    foreignKey.reference();
  }
};

/** Column name -> Drizzle column, for allowlisted filters and ordering. */
export const contentTableColumns = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  table: ContentTableFor<TDefinition>,
): Record<ContentColumnName<TDefinition>, PgColumn> => {
  const source = table as unknown as Record<string, PgColumn>;
  const names = [
    "id",
    "createdAt",
    "updatedAt",
    ...(definition.publication.enabled ? CONTENT_PUBLICATION_FIELDS : []),
    ...Object.keys(definition.fields),
  ];

  return Object.fromEntries(names.map(name => [name, source[name]])) as Record<
    ContentColumnName<TDefinition>,
    PgColumn
  >;
};
