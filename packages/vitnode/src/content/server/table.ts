import type {
  AnyPgColumnBuilder,
  PgColumn,
  PgTable,
} from "drizzle-orm/pg-core";

import { getColumnTable, getTableName } from "drizzle-orm";
import {
  camelCase,
  getTableConfig,
  index,
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
import { CONTENT_EDITORIAL_FIELDS, CONTENT_PUBLICATION_FIELDS } from "../const";
import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import { contentStorageColumns } from "../paths";
import {
  buildContentColumn,
  buildEditorialColumns,
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
    if (!column) {
      throw new ContentEngineError(
        `\`references.${name}\` resolved to nothing. Rebuild the plugin (\`build:plugins\`), and make sure the target table is exported from its \`src/database\` module.`,
        { contentTypeId },
      );
    }

    const actual = getTableName(getColumnTable(column));
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
      fieldValue.self
        ? `Self-relation "${name}" should not have an entry in \`references\` - the engine resolves it from the table it is building. This is an internal error.`
        : `Relation field "${name}" has no entry in \`references\`. Add \`${name}: () => <target_table>.id\`.`,
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
  // Shared only: a localized field's column lives on the generated translation
  // table, and `createContentTranslationTable` puts it there. Then flattened, so
  // a group contributes its leaf columns and the two collection kinds - which
  // have tables of their own - contribute nothing.
  const fields = contentStorageColumns(
    partitionContentFields(definition.fields).sharedFields,
  );
  const referenceThunks = references as Record<string, ColumnReferenceThunk>;

  const columns: Record<string, AnyPgColumnBuilder> = {
    ...buildSystemColumns(),
    ...(definition.publication.enabled ? buildPublicationColumns() : {}),
    ...(definition.editorial.enabled ? buildEditorialColumns() : {}),
  };

  for (const name of Object.keys(fields)) {
    columns[name] = buildContentColumn({
      contentTypeId,
      fieldValue: fields[name],
      name,
      reference: resolveReference(contentTypeId, name, fields, referenceThunks),
    });
  }

  // Checked against the *declared* fields rather than the flattened columns: a
  // to-many relation needs a reference thunk for its junction table's foreign
  // key, and it has no column here to be found by.
  const declaredFields = definition.fields;
  const unknownReference = Object.keys(referenceThunks).find(
    name => declaredFields[name]?.kind !== "relation",
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
  return camelCase.table.withRLS(
    tableName,
    () => columns,
    table => buildIndexes(table as unknown as Record<string, PgColumn>),
  ) as unknown as ContentTableFor<TDefinition>;
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

/**
 * Column name -> Drizzle column, for allowlisted filters and ordering.
 *
 * A group's leaves appear twice, under the generated column name *and* under the
 * canonical path: `columns["seoTitle"]` and `columns["seo.title"]` are the same
 * `PgColumn`. That alias is what lets a filter, an `orderBy`, a search
 * projection and an index all be configured in one vocabulary - paths - without
 * every one of them learning the column-naming rule. There is still exactly one
 * mapping, and it is the one `contentLeafColumnName` defines.
 */
export const contentTableColumns = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  table: ContentTableFor<TDefinition>,
): Record<ContentColumnName<TDefinition>, PgColumn> => {
  const source = table as unknown as Record<string, PgColumn>;
  const { sharedFields } = partitionContentFields(definition.fields);
  const names = [
    "id",
    "createdAt",
    "updatedAt",
    ...(definition.publication.enabled ? CONTENT_PUBLICATION_FIELDS : []),
    ...(definition.editorial.enabled ? CONTENT_EDITORIAL_FIELDS : []),
    ...Object.keys(contentStorageColumns(sharedFields)),
  ];

  return {
    ...Object.fromEntries(names.map(name => [name, source[name]])),
    ...Object.fromEntries(
      definition.advanced.leaves
        .filter(leaf => !leaf.localized)
        .map(leaf => [leaf.path, source[leaf.columnName]]),
    ),
  } as Record<ContentColumnName<TDefinition>, PgColumn>;
};
