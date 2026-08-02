import type { ColumnBaseConfig, SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq } from "drizzle-orm";
import { alias, getTableConfig } from "drizzle-orm/pg-core";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentSelect,
  ContentUpdateInput,
} from "../types";

import { withPagination } from "../../api/lib/with-pagination";
import { CONTENT_DEFAULT_PAGE_SIZE, CONTENT_OPTIONS_LIMIT } from "../const";
import { ContentEngineError } from "../errors";
import { orderableColumns } from "../registry";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  diffChangedFields,
  toColumnValues,
} from "./query";

/** Display labels for `user` and `relation` values, keyed by field name. */
export type ContentLabels = Record<string, null | string>;

export type ContentListRow<TDefinition> = ContentSelect<TDefinition> & {
  labels: ContentLabels;
};

export interface ContentPageInfo {
  count: number;
  endCursor: null | number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: null | number;
  totalCount: number;
}

export interface ContentFindManyArgs {
  /** Equality filters, keyed by field name. */
  filters?: Record<string, unknown>;
  orderBy?: { column?: string; order?: "asc" | "desc" };
  /** Raw pagination query (`cursor`, `first`, `last`, `search`). */
  query?: { cursor?: string; first?: string; last?: string; search?: string };
  where?: SQL;
}

/** The Drizzle client, or a transaction handle standing in for it. */
export type ContentDatabase = Context["var"]["db"];

export interface ContentServiceOptions {
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

export interface ContentUpdateResult<TDefinition> {
  changedFields: string[];
  row: ContentSelect<TDefinition>;
}

export interface ContentService<TDefinition> {
  create: (
    values: ContentCreateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition>>;
  delete: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition> | null>;
  findById: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition> | null>;
  findMany: (args?: ContentFindManyArgs) => Promise<{
    edges: ContentListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
  /** Options for a `user` or `relation` picker, filtered by a search term. */
  options: (
    field: string,
    search?: string,
  ) => Promise<{ label: string; value: number }[]>;
  update: (
    id: number,
    values: ContentUpdateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

interface ReferenceTarget {
  /** Aliased, so two relations pointing at the same table can both be joined. */
  aliased: PgTable;
  idColumn: PgColumn;
  labelColumn: PgColumn;
  owner: PgColumn;
}

const LABEL_PREFIX = "label__";

/**
 * Turns a joined label column value into display text. Only the shapes a title
 * column can actually hold are handled - anything else becomes `null` rather
 * than "[object Object]".
 */
const toLabel = (value: unknown): null | string => {
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
 */
const resolveReferenceTargets = (
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

/**
 * A typed repository bound to one request's database handle.
 *
 * Deliberately thin: it owns column allowlisting, pagination and label joins,
 * and leaves everything else to Drizzle. `model.table` stays public so advanced
 * plugin code can drop down to the query builder at any point.
 */
export const createContentService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  columns,
  definition,
  table,
}: {
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  table: PgTableWithColumns<TableConfig>;
}): ContentService<TDefinition> => {
  const fields = definition.fields;
  const contentTypeId = definition.id;
  // `buildSystemColumns` always makes `id` a `serial`, which is what
  // `withPagination` needs to type its cursor.
  const primaryCursor = columns.id as PgColumn<
    ColumnBaseConfig<"number", string>
  >;
  const orderable = orderableColumns(definition);
  const ownColumnNames = [
    "id",
    "createdAt",
    "updatedAt",
    ...Object.keys(fields),
  ];
  const references = resolveReferenceTargets(definition, table, columns);
  const searchColumns = definition.admin.list.searchableFields.map(
    name => columns[name],
  );

  const db = (options?: ContentServiceOptions): ContentDatabase =>
    options?.tx ?? c.get("db");

  const ownSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(ownColumnNames.map(name => [name, columns[name]]));

  const toRow = (row: Record<string, unknown>): ContentSelect<TDefinition> =>
    row as ContentSelect<TDefinition>;

  const splitLabels = (
    row: Record<string, unknown>,
  ): ContentListRow<TDefinition> => {
    const labels: ContentLabels = {};
    const values: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith(LABEL_PREFIX)) {
        labels[key.slice(LABEL_PREFIX.length)] = toLabel(value);
        continue;
      }
      values[key] = value;
    }

    return { ...values, labels } as ContentListRow<TDefinition>;
  };

  const readOne = async (
    id: number,
    database: ContentDatabase,
  ): Promise<null | Record<string, unknown>> => {
    const [row] = await database
      .select(ownSelection())
      .from(table)
      .where(eq(primaryCursor, id))
      .limit(1);

    return row ?? null;
  };

  return {
    create: async (values, options) => {
      const [row] = await db(options)
        .insert(table)
        .values(toColumnValues(fields, values as Record<string, unknown>))
        .returning(ownSelection());

      return toRow(row);
    },

    delete: async (id, options) => {
      const [row] = await db(options)
        .delete(table)
        .where(eq(primaryCursor, id))
        .returning(ownSelection());

      return row ? toRow(row) : null;
    },

    findById: async (id, options) => {
      const row = await readOne(id, db(options));

      return row ? toRow(row) : null;
    },

    findMany: async ({ filters = {}, orderBy, query = {}, where } = {}) => {
      const conditions = [
        where,
        buildFilterCondition({ columns, contentTypeId, fields, filters }),
        buildSearchCondition(searchColumns, query.search),
      ].filter((item): item is SQL => item !== undefined);

      const combined =
        conditions.length > 1 ? and(...conditions) : conditions[0];

      const data = await withPagination({
        c,
        // The search term is folded into `where` above so it can be escaped;
        // handing it to `withPagination` would build an unescaped `ilike`.
        params: { query: { ...query, search: undefined } },
        primaryCursor,
        orderBy: {
          column: buildOrderColumn({
            columns,
            contentTypeId,
            fallback: definition.admin.list.defaultOrderBy,
            orderBy: orderBy?.column,
            orderable,
          }),
          order: orderBy?.order ?? definition.admin.list.defaultOrder,
        },
        table,
        where: combined,
        query: async ({ limit, orderBy: order, where: rowWhere }) => {
          // One LEFT JOIN per reference field resolves every label in the same
          // round trip - there is no per-row lookup anywhere.
          const selection: Record<string, PgColumn> = {
            ...ownSelection(),
            ...Object.fromEntries(
              Object.entries(references).map(([name, target]) => [
                `${LABEL_PREFIX}${name}`,
                target.labelColumn,
              ]),
            ),
          };

          let builder = c.get("db").select(selection).from(table).$dynamic();

          for (const target of Object.values(references)) {
            builder = builder.leftJoin(
              target.aliased,
              eq(target.owner, target.idColumn),
            );
          }

          return await builder
            .where(rowWhere)
            .orderBy(order)
            .limit(
              typeof limit === "number" ? limit : CONTENT_DEFAULT_PAGE_SIZE,
            );
        },
      });

      return {
        edges: data.edges.map(splitLabels),
        pageInfo: data.pageInfo,
      };
    },

    options: async (fieldName, search) => {
      const target = references[fieldName];
      if (!target) {
        throw new ContentEngineError(
          `Field "${fieldName}" is not a relation or user field.`,
          { contentTypeId },
        );
      }

      const rows = await c
        .get("db")
        .select({ label: target.labelColumn, value: target.idColumn })
        .from(target.aliased)
        .where(buildSearchCondition([target.labelColumn], search))
        .orderBy(target.labelColumn)
        .limit(CONTENT_OPTIONS_LIMIT);

      return rows.map(row => {
        const value = Number(row.value);

        return { label: toLabel(row.label) ?? String(value), value };
      });
    },

    update: async (id, values, options) => {
      const database = db(options);
      const current = await readOne(id, database);
      if (!current) return null;

      const patch = values as Record<string, unknown>;
      const changedFields = diffChangedFields(current, patch);

      // Nothing actually moved - skip the write so `updatedAt` and the
      // `content.*.updated` event both stay honest.
      if (changedFields.length === 0) {
        return { changedFields, row: toRow(current) };
      }

      const [row] = await database
        .update(table)
        .set(
          toColumnValues(
            fields,
            Object.fromEntries(changedFields.map(key => [key, patch[key]])),
          ),
        )
        .where(eq(primaryCursor, id))
        .returning(ownSelection());

      return { changedFields, row: toRow(row) };
    },
  };
};
