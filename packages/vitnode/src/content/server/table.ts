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

import type { ContentIdStrategy } from "../ids";
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

import { core_files } from "../../database/files";
import { core_users } from "../../database/users";
import {
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_VISIBILITY_FIELDS,
} from "../const";
import { ContentEngineError } from "../errors";
import { contentIdSqlType } from "../ids";
import { partitionContentFields } from "../localization";
import { contentStorageColumns } from "../paths";
import { contentRichTextSearchColumns } from "../rich-text";
import {
  buildContentColumn,
  buildContentSearchTextColumn,
  buildEditorialColumns,
  buildPublicationColumns,
  buildSystemColumns,
  buildVisibilityColumns,
} from "./column-builders";

/**
 * The SQL types a primary key of `strategy` may be declared as. A `serial`
 * reports itself as `serial`, and a hand-written target table may well use a
 * plain `integer` key.
 */
const ACCEPTED_KEY_TYPES: Record<ContentIdStrategy, readonly string[]> = {
  bigint: ["bigint", "bigserial"],
  serial: ["serial", "integer"],
  uuid: ["uuid"],
};

/**
 * Asserts that the column a foreign key points at has the type the key itself
 * was built with. Read lazily, like every reference: a relation's target is a
 * thunk precisely because it may not exist yet when this table is built.
 */
export const assertContentReferenceType = ({
  column,
  contentTypeId,
  name,
  strategy,
}: {
  column: { getSQLType: () => string };
  contentTypeId: string;
  name: string;
  strategy: ContentIdStrategy;
}): void => {
  const actual = column.getSQLType();
  if (ACCEPTED_KEY_TYPES[strategy].includes(actual)) return;

  throw new ContentEngineError(
    `Relation field "${name}" targets a content type with \`idStrategy: "${strategy}"\`, so its foreign key is a \`${contentIdSqlType(strategy)}\` - but the referenced column is a \`${actual}\`. Make the target's \`idStrategy\` and its table agree.`,
    { contentTypeId },
  );
};

/**
 * The strategy a relation's foreign key column is built with.
 *
 * A table is built while modules are still loading, and a relation's target is
 * a thunk precisely so it need not exist yet - so this never insists on reading
 * it. A target that resolves (the normal case: `src/database` runs after every
 * `src/content` module) gives its own strategy; one that cannot be read yet is
 * assumed `serial`, the only strategy that existed before this choice did. The
 * lazy check in `checkedReference` then compares the column it actually points
 * at with the one that was built, and names the field if they disagree - so a
 * wrong guess is a clear error when the foreign key resolves, never a silently
 * mistyped column.
 */
export const contentRelationBuildStrategy = (
  owner: { idStrategy: ContentIdStrategy },
  fieldValue: {
    self: boolean;
    target: () => undefined | { idStrategy: ContentIdStrategy };
  },
): ContentIdStrategy => {
  if (fieldValue.self) return owner.idStrategy;

  try {
    return fieldValue.target()?.idStrategy ?? "serial";
  } catch {
    return "serial";
  }
};

const checkedReference = (
  contentTypeId: string,
  name: string,
  expectedTableName: () => string,
  thunk: ColumnReferenceThunk,
  strategy?: () => ContentIdStrategy,
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

    if (strategy) {
      assertContentReferenceType({
        column,
        contentTypeId,
        name,
        strategy: strategy(),
      });
    }

    return column;
  };
};

const resolveReference = (
  contentTypeId: string,
  name: string,
  fields: ContentFieldMap,
  references: Record<string, ColumnReferenceThunk>,
  builtStrategy?: ContentIdStrategy,
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
  // Resolved by the engine, exactly like a `user` field: there is one files
  // table in an installation, so asking a plugin to name it in `references`
  // would be a line of boilerplate with one correct value.
  if (fieldValue.kind === "file") {
    return checkedReference(
      contentTypeId,
      name,
      () => getTableName(core_files),
      () => core_files.id,
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
    // The strategy the column was *built* with - decided once, below - which
    // is what the referenced key has to match.
    builtStrategy === undefined ? undefined : () => builtStrategy,
  );
};

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
    ...buildSystemColumns(definition.idStrategy),
    ...(definition.publication.enabled ? buildPublicationColumns() : {}),
    ...(definition.editorial.enabled ? buildEditorialColumns() : {}),
    ...(definition.visibility.enabled
      ? buildVisibilityColumns(() => core_users.id)
      : {}),
  };

  for (const name of Object.keys(fields)) {
    const fieldValue = fields[name];
    // Only a to-one relation has a strategy to follow - its target's, decided
    // once here and checked against the referenced key when it resolves.
    const referenceStrategy =
      fieldValue.kind === "relation"
        ? contentRelationBuildStrategy(definition, fieldValue)
        : undefined;
    columns[name] = buildContentColumn({
      contentTypeId,
      fieldValue,
      name,
      reference: resolveReference(
        contentTypeId,
        name,
        fields,
        referenceThunks,
        referenceStrategy,
      ),
      referenceStrategy,
    });
  }

  for (const entry of contentRichTextSearchColumns(definition)) {
    if (entry.localized) continue;

    columns[entry.searchColumn] = buildContentSearchTextColumn();
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

export const assertContentReferences = (table: PgTable): void => {
  for (const foreignKey of getTableConfig(table).foreignKeys) {
    foreignKey.reference();
  }
};

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
    ...(definition.visibility.enabled ? CONTENT_VISIBILITY_FIELDS : []),
    ...Object.keys(contentStorageColumns(sharedFields)),
    // Registered under their own names, never under the field's: selecting
    // `columns.body` must keep returning the HTML.
    ...contentRichTextSearchColumns(definition)
      .filter(entry => !entry.localized)
      .map(entry => entry.searchColumn),
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
