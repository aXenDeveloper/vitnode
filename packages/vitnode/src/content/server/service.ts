import type { ColumnBaseConfig, SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, ne, sql } from "drizzle-orm";

import type { ContentSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentAdvancedValues,
  ContentChangedPath,
  ContentCreateInput,
  ContentDetail,
  ContentFilterInput,
  ContentOrderableFieldName,
  ContentReferenceFieldName,
  ContentSelect,
  ContentUpdateInput,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_DEFAULT_PAGE_SIZE,
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_OPTIONS_LIMIT,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SYSTEM_FIELDS,
} from "../const";
import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import { contentColumnsToValues, contentStorageColumns } from "../paths";
import { orderableColumns } from "../registry";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  changedPathsToColumns,
  diffChangedPaths,
  toInsertColumns,
} from "./query";
import { LABEL_PREFIX, resolveReferenceTargets, toLabel } from "./references";
import { createSlugNormalizer } from "./slugs";

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

export interface ContentFindManyArgs<TDefinition> {
  /** Equality filters, keyed by filterable field name. */
  filters?: ContentFilterInput<TDefinition>;
  orderBy?: {
    column?: ContentOrderableFieldName<TDefinition>;
    order?: "asc" | "desc";
  };
  /** Raw pagination query (`cursor`, `first`, `last`, `search`). */
  query?: { cursor?: string; first?: string; last?: string; search?: string };
  where?: SQL;
}

/**
 * The Drizzle client, or a transaction handle standing in for it.
 *
 * `$client` is omitted deliberately: a `PgTransaction` carries every query
 * method the client does but not the raw driver handle, so naming the client
 * type directly would make `db.transaction(async tx => service.update(id, v,
 * { tx }))` - the whole point of the option - a type error.
 */
export type ContentDatabase = Omit<Context["var"]["db"], "$client">;

export interface ContentServiceOptions {
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

export interface ContentUpdateResult<TDefinition> {
  /**
   * Canonical paths, not field names: a group reports the **leaves** that moved
   * (`seo.description`), a scalar reports itself, and a collection reports
   * itself whole. One vocabulary, so an event payload, a cache decision and a
   * search decision are all made from the same strings.
   */
  changedFields: ContentChangedPath<TDefinition>[];
  row: ContentSelect<TDefinition>;
}

/**
 * The typed collection API of one content type.
 *
 * Every method is a thin wrapper over `update`, and deliberately so: a relation
 * or repeatable mutation *is* an edit of the source record, so it has to take
 * the same lock, bump the same version, leave the same revision, emit the same
 * event and invalidate the same tags. Routing them through one write path is
 * what makes that true by construction instead of by six call sites remembering.
 */
export interface ContentRelationMethods<TDefinition> {
  /** Adds one target. A target already present is a no-op. */
  add: (
    itemId: number,
    relatedItemId: number,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** The current targets, in stored order. */
  get: (itemId: number, options?: ContentServiceOptions) => Promise<number[]>;
  /** Removes one target. A target that is not there is a no-op. */
  remove: (
    itemId: number,
    relatedItemId: number,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /**
   * Rearranges the existing targets.
   *
   * Refuses a list that is not a permutation of what is stored - a reorder that
   * silently added or dropped a target would be a `set` wearing a different
   * name, and the caller would never find out which it got.
   */
  reorder: (
    itemId: number,
    relatedItemIds: readonly number[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** Replaces the whole set. */
  set: (
    itemId: number,
    relatedItemIds: readonly number[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

export interface ContentRepeatableMethods<TDefinition> {
  /** Appends one child. */
  create: (
    itemId: number,
    values: Record<string, unknown>,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** Removes one child by its stable identifier. */
  delete: (
    itemId: number,
    childId: number,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** The current children, in position order, each with its identifier. */
  list: (
    itemId: number,
    options?: ContentServiceOptions,
  ) => Promise<Record<string, unknown>[]>;
  /** Rearranges the existing children. Refuses a non-permutation. */
  reorder: (
    itemId: number,
    childIds: readonly number[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /**
   * Replaces the whole list in one write - the operation an AdminCP form save
   * actually needs, so saving a five-row FAQ is one request rather than five.
   *
   * A child with an `id` is updated in place and keeps it; one without is
   * created. Anything absent is removed.
   */
  set: (
    itemId: number,
    rows: readonly Record<string, unknown>[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** Updates one child by its stable identifier. */
  update: (
    itemId: number,
    childId: number,
    values: Record<string, unknown>,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

/**
 * Options for a collection mutation.
 *
 * `expectedVersion` is the source record's, and it is optional here for the same
 * reason it does not exist at all on the plain `update`: this service is the
 * non-editorial one, which has no `version` column to guard on and serialises
 * concurrent writers with `SELECT ... FOR UPDATE` instead. The editorial service
 * takes a required one - see `ContentEditorialWriteOptions`.
 */
export interface ContentWriteOptions extends ContentServiceOptions {
  expectedVersion?: number;
}

export interface ContentPublicationResult<TDefinition> {
  /**
   * `false` when the row was already in that state: no write happened, no event
   * was emitted, and nothing needs invalidating.
   */
  changed: boolean;
  /**
   * When the row was first published, or `null` if it never has been. Lifted
   * out of `row` because the generated columns are conditional on a type
   * parameter that is still open in generic route code.
   */
  publishedAt: Date | null;
  row: ContentSelect<TDefinition>;
}

export interface ContentPublicationMethods<TDefinition> {
  /**
   * Idempotent. Stamps `publishedAt` on the first `draft -> published`
   * transition and never rewrites it. `null` when the row does not exist.
   */
  publish: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentPublicationResult<TDefinition> | null>;
  /** Idempotent. Flips `status` only - `publishedAt` is left alone. */
  unpublish: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentPublicationResult<TDefinition> | null>;
}

/**
 * `publish`/`unpublish` exist only on a content type with publication enabled.
 *
 * The `never` branch is the same trick `ContentFieldsConstraint` uses for
 * reserved system columns: calling `service.publish(...)` on a content type
 * without publication is a compile error rather than a runtime surprise.
 */
export type ContentService<TDefinition> = ContentServiceBase<TDefinition> &
  (TDefinition extends { publication: { enabled: true } }
    ? ContentPublicationMethods<TDefinition>
    : Partial<Record<keyof ContentPublicationMethods<TDefinition>, never>>);

export interface ContentServiceBase<TDefinition> {
  /** The advanced collections of one record. Two queries per collection field. */
  advanced: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentAdvancedValues<TDefinition>>;
  /** Throws a `ZodError` if `values` does not satisfy `schemas.create`. */
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
  /**
   * One record with its advanced collections attached.
   *
   * The read an edit form makes, and the only one that loads collections: a
   * list must not, or it would issue a query per row.
   */
  findDetail: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentDetail<TDefinition> | null>;
  findMany: (args?: ContentFindManyArgs<TDefinition>) => Promise<{
    edges: ContentListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
  /** Options for a `user` or `relation` picker, filtered by a search term. */
  options: (
    field: ContentReferenceFieldName<TDefinition>,
    search?: string,
  ) => Promise<{ label: string; value: number }[]>;
  /**
   * Typed to-many relation operations, keyed by field name.
   *
   * Empty for a content type that declares none, so `service.relations` always
   * exists and `service.relations.categories` is a compile error unless there is
   * a `categories`.
   */
  relations: Record<string, ContentRelationMethods<TDefinition>>;
  /** Typed repeatable operations, keyed by field name. */
  repeatable: Record<string, ContentRepeatableMethods<TDefinition>>;
  /** Throws a `ZodError` if `values` does not satisfy `schemas.update`. */
  update: (
    id: number,
    values: ContentUpdateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

/**
 * A typed repository bound to one request's database handle.
 *
 * Deliberately thin: it owns validation, column allowlisting, pagination and
 * label joins, and leaves everything else to Drizzle. `model.table` stays
 * public so advanced plugin code can drop down to the query builder at any
 * point.
 */
export const createContentService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  advanced,
  c,
  columns,
  definition,
  schemas,
  table,
}: {
  /**
   * The collection store, or nothing for a content type that declares none.
   *
   * Optional so every existing caller - and every test that builds a service by
   * hand - keeps working unchanged; a service without one simply has no
   * collections to read or write.
   */
  advanced?: ContentAdvancedStore;
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  schemas: ContentSchemas<TDefinition>;
  table: PgTableWithColumns<TableConfig>;
}): ContentService<TDefinition> => {
  // Shared only, everywhere in this file: this service reads and writes the base
  // table, and a localized field is not a column on it. The translation model
  // owns the other half.
  const { collectionFields, sharedFields } = partitionContentFields(
    definition.fields,
  );
  const fields = sharedFields;
  // Groups flattened, so every `SELECT`, `INSERT` and `UPDATE` below addresses
  // real columns and nothing has to know what a group is.
  const storageColumns = contentStorageColumns(fields);
  const filterableFields = { ...fields, ...collectionFields };
  const store = advanced;
  const contentTypeId = definition.id;
  // `buildSystemColumns` always makes `id` a `serial`, which is what
  // `withPagination` needs to type its cursor.
  const primaryCursor = columns.id as PgColumn<
    ColumnBaseConfig<"number", string>
  >;
  const orderable = orderableColumns(definition);
  const publication = definition.publication.enabled;
  const generatedColumnNames = [
    ...CONTENT_SYSTEM_FIELDS,
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
    ...(definition.editorial.enabled ? CONTENT_EDITORIAL_FIELDS : []),
  ];
  const ownColumnNames = [
    ...generatedColumnNames,
    ...Object.keys(storageColumns),
  ];
  const references = resolveReferenceTargets(definition, table, columns);
  const searchColumns = definition.admin.list.searchableFields.map(
    name => columns[name],
  );
  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    fields,
  );

  const db = (options?: ContentServiceOptions): ContentDatabase =>
    options?.tx ?? c.get("db");

  const ownSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(ownColumnNames.map(name => [name, columns[name]]));

  /**
   * A database row, in the logical shape callers see.
   *
   * The generated columns pass straight through; the declared fields go through
   * `contentColumnsToValues`, which folds `seo_title` and `seo_description` back
   * into `seo: { title, description }` - or into `seo: null` when the group is
   * nullable and every leaf is empty. For a content type with no group this is
   * a copy, which is why a Stage 1-5 row comes back byte-identical.
   */
  const projectRow = (
    row: Record<string, unknown>,
  ): Record<string, unknown> => {
    const projected: Record<string, unknown> = {};

    for (const name of generatedColumnNames) {
      if (name in row) projected[name] = row[name];
    }

    return { ...projected, ...contentColumnsToValues(fields, row) };
  };

  const toRow = (row: Record<string, unknown>): ContentSelect<TDefinition> =>
    projectRow(row) as ContentSelect<TDefinition>;

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

    return { ...projectRow(values), labels } as ContentListRow<TDefinition>;
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

  /** Reads the generated column off a raw row, before it is cast to a select. */
  const publishedAtOf = (row: Record<string, unknown>): Date | null => {
    const value = row.publishedAt;

    return value instanceof Date ? value : null;
  };

  /**
   * One conditional UPDATE does the whole job: the `WHERE` clause is what makes
   * the transition atomic, so two concurrent publishes cannot both stamp
   * `publishedAt`, and no read-then-write race exists. The extra SELECT only
   * runs when nothing matched, to tell "already in that state" from "no such
   * row" - a distinction the route turns into 200 vs 404.
   */
  const transition = async (
    id: number,
    options: ContentServiceOptions | undefined,
    values: Record<string, unknown>,
    guard: SQL,
  ): Promise<ContentPublicationResult<TDefinition> | null> => {
    const database = db(options);

    const [row] = await database
      .update(table)
      .set(values)
      .where(and(eq(primaryCursor, id), guard))
      .returning(ownSelection());

    if (row)
      return {
        changed: true,
        publishedAt: publishedAtOf(row),
        row: toRow(row),
      };

    const current = await readOne(id, database);

    return current
      ? {
          changed: false,
          publishedAt: publishedAtOf(current),
          row: toRow(current),
        }
      : null;
  };

  const publicationMethods: ContentPublicationMethods<TDefinition> = {
    publish: async (id, options) =>
      await transition(
        id,
        options,
        {
          // COALESCE, so a republish keeps the original date. `publishedAt` is
          // the first-published timestamp and is never rewritten.
          publishedAt: sql`coalesce(${columns.publishedAt}, now())`,
          status: "published",
        },
        ne(columns.status, "published"),
      ),

    unpublish: async (id, options) =>
      await transition(
        id,
        options,
        { status: "draft" },
        eq(columns.status, "published"),
      ),
  };

  /**
   * Runs `body` in the caller's transaction, or in one opened for it.
   *
   * A create or update that also writes collections has to be atomic: a base row
   * that committed with half its categories is worse than one that failed. A
   * content type with no collections keeps the single-statement path it always
   * had, because opening a transaction to run one `INSERT` is pure cost.
   */
  const transact = async <TResult>(
    options: ContentServiceOptions | undefined,
    body: (tx: ContentDatabase) => Promise<TResult>,
  ): Promise<TResult> => {
    if (options?.tx) return await body(options.tx);
    if (!store?.enabled) return await body(c.get("db"));

    return await c.get("db").transaction(async tx => await body(tx));
  };

  /**
   * Serialises concurrent collection writers on a **non-editorial** content
   * type.
   *
   * There is no `version` column to guard on here, so the row lock does the job
   * the guarded UPDATE does on an editorial content type: two `set` calls for
   * the same record run one after the other, and the second sees the first's
   * result rather than the state they both read. Records are independent because
   * the lock is per row.
   */
  const lockRow = async (tx: ContentDatabase, id: number): Promise<boolean> => {
    if (!store?.enabled) return true;

    const [row] = await tx
      .select({ id: primaryCursor })
      .from(table)
      .where(eq(primaryCursor, id))
      .limit(1)
      .for("update");

    return row !== undefined;
  };

  const service: ContentServiceBase<TDefinition> = {
    advanced: async (id, options) =>
      ((await store?.load(id, db(options))) ??
        {}) as ContentAdvancedValues<TDefinition>,

    create: async (values, options) =>
      await transact(options, async tx => {
        // Generated routes validate too, but a plugin can call the service
        // directly - and then this is the only thing standing between an
        // untrusted object and Drizzle. Only the parsed result is written.
        const parsed = schemas.create.parse(values) as Record<string, unknown>;

        const [row] = await tx
          .insert(table)
          .values(toInsertColumns(fields, withCreateSlugs(parsed)))
          .returning(ownSelection());

        // In the same transaction as the row it belongs to: a create that
        // committed its categories and rolled back its article would leave
        // junction rows pointing at nothing.
        if (store?.enabled && typeof row.id === "number") {
          await store.write(tx, row.id, parsed);
        }

        return toRow(row);
      }),

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

    findDetail: async (id, options) => {
      const database = db(options);
      const row = await readOne(id, database);
      if (!row) return null;

      return {
        ...toRow(row),
        ...(await store?.load(id, database)),
      } as ContentDetail<TDefinition>;
    },

    findMany: async ({ filters = {}, orderBy, query = {}, where } = {}) => {
      const conditions = [
        where,
        buildFilterCondition({
          columns,
          contentTypeId,
          fields: filterableFields,
          // Typed per field for callers; the allowlist check inside stays as
          // defence in depth for anything that arrives from a query string.
          filters: filters,
          membership: store?.membershipCondition,
          publication,
        }),
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

    relations: {},

    repeatable: {},

    update: async (id, values, options) =>
      await transact(options, async tx => {
        // Parsed before the row is even read, so an invalid payload never costs
        // a query - and never reaches Drizzle. Normalised before the diff, so
        // re-sending the stored slug in a different case counts as no change
        // rather than as a pointless write.
        const patch = withUpdateSlugs(schemas.update.parse(values));

        if (!(await lockRow(tx, id))) return null;

        const current = await readOne(id, tx);
        if (!current) return null;

        const changedPaths = diffChangedPaths(fields, current, patch);
        // Read before anything is written, so "nothing moved" is decided once
        // and the collection write below is not a second, separate decision.
        const changedCollections = (await store?.diff(tx, id, patch)) ?? [];
        const changedFields = [...changedPaths, ...changedCollections];

        // Nothing actually moved - skip the write so `updatedAt` and the
        // `content.*.updated` event both stay honest. A reorder to the order
        // that is already stored lands here.
        if (changedFields.length === 0) {
          return {
            changedFields: changedFields as ContentChangedPath<TDefinition>[],
            row: toRow(current),
          };
        }

        if (changedCollections.length > 0) await store?.write(tx, id, patch);

        // `updatedAt` has to move even when only a collection changed: it is
        // what an editor sees as "last edited", and a category swap is an edit.
        const [row] = await tx
          .update(table)
          .set(
            changedPaths.length > 0
              ? changedPathsToColumns(fields, patch, changedPaths)
              : { updatedAt: new Date() },
          )
          .where(eq(primaryCursor, id))
          .returning(ownSelection());

        return {
          changedFields: changedFields as ContentChangedPath<TDefinition>[],
          row: toRow(row),
        };
      }),
  };

  /**
   * Turns a collection field into the five typed operations callers use.
   *
   * Each one reads the current state, computes the whole new list and hands it
   * to `update` - so every one of them inherits the no-op rule, the row lock,
   * the `updatedAt` bump and, on the editorial service, the version guard, the
   * revision and the event. There is no second write path to keep in step.
   */
  const relationMethods = (
    field: string,
  ): ContentRelationMethods<TDefinition> => {
    const read = async (
      itemId: number,
      options?: ContentServiceOptions,
    ): Promise<number[]> => {
      const loaded = await store?.load(itemId, db(options));
      const value = loaded?.[field];

      return Array.isArray(value) ? (value as number[]) : [];
    };

    const write = async (
      itemId: number,
      next: readonly number[],
      options?: ContentWriteOptions,
    ): Promise<ContentUpdateResult<TDefinition> | null> =>
      service.update(
        itemId,
        { [field]: [...next] } as ContentUpdateInput<TDefinition>,
        options,
      );

    return {
      add: async (itemId, relatedItemId, options) => {
        const current = await read(itemId, options);

        return await write(
          itemId,
          current.includes(relatedItemId)
            ? current
            : [...current, relatedItemId],
          options,
        );
      },

      get: read,

      remove: async (itemId, relatedItemId, options) =>
        await write(
          itemId,
          (await read(itemId, options)).filter(id => id !== relatedItemId),
          options,
        ),

      reorder: async (itemId, relatedItemIds, options) => {
        const current = await read(itemId, options);
        assertPermutation(field, current, relatedItemIds, "target");

        return await write(itemId, relatedItemIds, options);
      },

      set: async (itemId, relatedItemIds, options) =>
        await write(itemId, relatedItemIds, options),
    };
  };

  const repeatableMethods = (
    field: string,
  ): ContentRepeatableMethods<TDefinition> => {
    const read = async (
      itemId: number,
      options?: ContentServiceOptions,
    ): Promise<Record<string, unknown>[]> => {
      const loaded = await store?.load(itemId, db(options));
      const value = loaded?.[field];

      return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    };

    const write = async (
      itemId: number,
      rows: readonly Record<string, unknown>[],
      options?: ContentWriteOptions,
    ): Promise<ContentUpdateResult<TDefinition> | null> =>
      service.update(
        itemId,
        { [field]: [...rows] } as ContentUpdateInput<TDefinition>,
        options,
      );

    return {
      create: async (itemId, values, options) =>
        await write(
          itemId,
          [...(await read(itemId, options)), values],
          options,
        ),

      delete: async (itemId, childId, options) =>
        await write(
          itemId,
          (await read(itemId, options)).filter(row => row.id !== childId),
          options,
        ),

      list: read,

      reorder: async (itemId, childIds, options) => {
        const current = await read(itemId, options);
        assertPermutation(
          field,
          current.map(row => Number(row.id)),
          childIds,
          "entry",
        );

        const byId = new Map(current.map(row => [Number(row.id), row]));

        return await write(
          itemId,
          childIds.map(childId => byId.get(childId) ?? {}),
          options,
        );
      },

      set: async (itemId, rows, options) => await write(itemId, rows, options),

      update: async (itemId, childId, values, options) =>
        await write(
          itemId,
          (await read(itemId, options)).map(row =>
            row.id === childId ? { ...row, ...values, id: childId } : row,
          ),
          options,
        ),
    };
  };

  /**
   * A reorder has to be a permutation of what is stored.
   *
   * Refused rather than treated as a `set`, because the two mean different
   * things and only one of them is reversible by looking at the request: a
   * reorder that silently dropped an entry would look like a successful drag.
   */
  const assertPermutation = (
    field: string,
    current: readonly number[],
    next: readonly number[],
    noun: string,
  ): void => {
    const before = [...current].sort((a, b) => a - b);
    const after = [...new Set(next)].sort((a, b) => a - b);

    const same =
      before.length === after.length &&
      before.every((id, index) => id === after[index]);
    if (same && next.length === new Set(next).size) return;

    throw new ContentEngineError(
      `Reorder of "${field}" must list exactly the ${noun} ids it already has, once each. Use \`set\` to add or remove.`,
      { contentTypeId },
    );
  };

  for (const field of store?.fields ?? []) {
    if (definition.fields[field]?.kind === "repeatable") {
      service.repeatable[field] = repeatableMethods(field);
      continue;
    }
    service.relations[field] = relationMethods(field);
  }

  // `ContentService` resolves its publication half from
  // `TDefinition["publication"]["enabled"]`, which is still a type parameter
  // here - so TypeScript cannot check the object against a branch it has not
  // picked yet. The runtime flag and the conditional type read the same
  // `definition.publication.enabled`, which is what makes the two agree;
  // `publication.test-d.ts` asserts it from the outside.
  return {
    ...service,
    ...(publication ? publicationMethods : {}),
  } as ContentService<TDefinition>;
};
