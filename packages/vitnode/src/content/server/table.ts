import type { PgColumn, PgColumnBuilderBase } from "drizzle-orm/pg-core";

import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import type {
  AnyContentTypeDefinition,
  ContentFieldMap,
  ContentIndexConfig,
} from "../types";
import type { ColumnReferenceThunk } from "./column-builders";
import type {
  ContentColumnName,
  ContentReferences,
  ContentTableFor,
} from "./types";

import { core_users } from "../../database/users";
import { ContentEngineError } from "../errors";
import { buildContentColumn, buildSystemColumns } from "./column-builders";

const referenceIndexName = (tableName: string, column: string): string =>
  `${tableName}_${column.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`)}_idx`;

const resolveReference = (
  contentTypeId: string,
  name: string,
  fields: ContentFieldMap,
  references: Record<string, ColumnReferenceThunk>,
): ColumnReferenceThunk | undefined => {
  const fieldValue = fields[name];

  if (fieldValue.kind === "user") return () => core_users.id;
  if (fieldValue.kind !== "relation") return undefined;

  const thunk = references[name];
  if (!thunk) {
    throw new ContentEngineError(
      `Relation field "${name}" has no entry in \`references\`. Add \`${name}: () => <target_table>.id\`.`,
      { contentTypeId },
    );
  }

  return thunk;
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
  const { id: contentTypeId, indexes, tableName } = definition;
  const fields = definition.fields;
  const referenceThunks = references as Record<string, ColumnReferenceThunk>;

  const columns: Record<string, PgColumnBuilderBase> = buildSystemColumns();
  const referenceColumns: string[] = [];

  for (const [name, fieldValue] of Object.entries(fields)) {
    columns[name] = buildContentColumn({
      contentTypeId,
      fieldValue,
      name,
      reference: resolveReference(contentTypeId, name, fields, referenceThunks),
    });

    if (fieldValue.kind === "relation" || fieldValue.kind === "user") {
      referenceColumns.push(name);
    }
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

  const buildIndexes = (columnMap: Record<string, PgColumn>) => {
    const pick = (name: string): PgColumn => columnMap[name];

    // Timestamps back the default ordering, and every foreign key gets an index
    // so list joins and cascade checks stay cheap.
    const defaults = ["createdAt", "updatedAt", ...referenceColumns].map(name =>
      index(referenceIndexName(tableName, name)).on(pick(name)),
    );

    const declared = indexes.map((config: ContentIndexConfig) => {
      const [first, ...rest] = config.on.map(pick);
      const name =
        config.name ?? `${tableName}_${config.on.join("_").toLowerCase()}_idx`;

      return config.unique
        ? uniqueIndex(name).on(first, ...rest)
        : index(name).on(first, ...rest);
    });

    return [...defaults, ...declared];
  };

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
    ...Object.keys(definition.fields),
  ];

  return Object.fromEntries(names.map(name => [name, source[name]])) as Record<
    ContentColumnName<TDefinition>,
    PgColumn
  >;
};
