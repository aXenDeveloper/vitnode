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
  ContentCreateInput,
  ContentFieldMap,
  ContentFieldName,
  ContentFilterInput,
  ContentOrderableFieldName,
  ContentReferenceFieldName,
  ContentSelect,
  ContentUpdateInput,
} from "../types";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_DEFAULT_PAGE_SIZE,
  CONTENT_OPTIONS_LIMIT,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SLUG_DEFAULT_LENGTH,
} from "../const";
import { ContentEngineError, ContentInputError } from "../errors";
import { orderableColumns } from "../registry";
import { slugify } from "../slug";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  diffChangedFields,
  toColumnValues,
} from "./query";
import { LABEL_PREFIX, resolveReferenceTargets, toLabel } from "./references";

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

/** The Drizzle client, or a transaction handle standing in for it. */
export type ContentDatabase = Context["var"]["db"];

export interface ContentServiceOptions {
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

export interface ContentUpdateResult<TDefinition> {
  changedFields: ContentFieldName<TDefinition>[];
  row: ContentSelect<TDefinition>;
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
  findMany: (args?: ContentFindManyArgs<TDefinition>) => Promise<{
    edges: ContentListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
  /** Options for a `user` or `relation` picker, filtered by a search term. */
  options: (
    field: ContentReferenceFieldName<TDefinition>,
    search?: string,
  ) => Promise<{ label: string; value: number }[]>;
  /** Throws a `ZodError` if `values` does not satisfy `schemas.update`. */
  update: (
    id: number,
    values: ContentUpdateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

interface SlugFieldConfig {
  maxLength: number;
  name: string;
  /** Field the value is derived from when a create payload omits the slug. */
  source: string | undefined;
}

const slugFieldsOf = (fields: ContentFieldMap): SlugFieldConfig[] => {
  const slugFields: SlugFieldConfig[] = [];

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "slug") continue;

    slugFields.push({
      maxLength: fieldValue.maxLength ?? CONTENT_SLUG_DEFAULT_LENGTH,
      name,
      source: fieldValue.source,
    });
  }

  return slugFields;
};

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
  c,
  columns,
  definition,
  schemas,
  table,
}: {
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  schemas: ContentSchemas<TDefinition>;
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
  // `Object.keys` erases the key union that `ContentFieldName` recovers. The
  // object is the very field map that type is derived from, so this restates
  // what TypeScript already knows rather than asserting anything new.
  const fieldNames = Object.keys(fields) as ContentFieldName<TDefinition>[];
  const publication = definition.publication.enabled;
  const ownColumnNames = [
    "id",
    "createdAt",
    "updatedAt",
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
    ...fieldNames,
  ];
  const references = resolveReferenceTargets(definition, table, columns);
  const searchColumns = definition.admin.list.searchableFields.map(
    name => columns[name],
  );
  const slugFields = slugFieldsOf(fields);

  /**
   * Normalises a slug and refuses one that folds to nothing.
   *
   * Nothing random or numeric is appended - `slugify` is deterministic, and
   * uniqueness belongs to the unique index, which surfaces a clash as a 409.
   */
  const toSlug = (
    slugField: SlugFieldConfig,
    value: string,
    derived: boolean,
  ): string => {
    const slug = slugify(value, slugField.maxLength);
    if (slug !== "") return slug;

    throw new ContentInputError(
      derived
        ? `Could not derive "${slugField.name}" from "${slugField.source}". Send "${slugField.name}" explicitly.`
        : `Field "${slugField.name}" normalises to an empty slug. Use at least one letter or digit.`,
      { contentTypeId },
    );
  };

  /**
   * Fills in and normalises every slug on the way into a create.
   *
   * A supplied value is normalised rather than trusted, so the same rules apply
   * whether the slug came from the caller or from the source field.
   */
  const withCreateSlugs = (
    values: Record<string, unknown>,
  ): Record<string, unknown> => {
    if (slugFields.length === 0) return values;

    const next = { ...values };

    for (const slugField of slugFields) {
      const supplied = next[slugField.name];

      if (typeof supplied === "string") {
        next[slugField.name] = toSlug(slugField, supplied, false);
        continue;
      }

      // `assertSlugSources` guarantees a source exists whenever the create
      // schema lets the value be omitted, so this is the derived branch.
      const source = slugField.source ?? "";
      const from = next[source];

      next[slugField.name] = toSlug(
        slugField,
        typeof from === "string" ? from : "",
        true,
      );
    }

    return next;
  };

  /**
   * Normalises the slugs an update actually names, and only those.
   *
   * A slug is never re-derived here: editing the title of a published article
   * must not silently move its URL and 404 every link to it. Sending the slug
   * is the only way to change it.
   */
  const withUpdateSlugs = (
    patch: Record<string, unknown>,
  ): Record<string, unknown> => {
    if (slugFields.length === 0) return patch;

    const next = { ...patch };

    for (const slugField of slugFields) {
      const supplied = next[slugField.name];
      if (typeof supplied !== "string") continue;

      next[slugField.name] = toSlug(slugField, supplied, false);
    }

    return next;
  };

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

  const service: ContentServiceBase<TDefinition> = {
    create: async (values, options) => {
      // Generated routes validate too, but a plugin can call the service
      // directly - and then this is the only thing standing between an
      // untrusted object and Drizzle. Only the parsed result is written.
      const parsed = schemas.create.parse(values) as Record<string, unknown>;

      const [row] = await db(options)
        .insert(table)
        .values(toColumnValues(fields, withCreateSlugs(parsed)))
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
        buildFilterCondition({
          columns,
          contentTypeId,
          fields,
          // Typed per field for callers; the allowlist check inside stays as
          // defence in depth for anything that arrives from a query string.
          filters: filters,
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

    update: async (id, values, options) => {
      // Parsed before the row is even read, so an invalid payload never costs a
      // query - and never reaches Drizzle.
      // Normalised before the diff, so re-sending the stored slug in a
      // different case counts as no change rather than as a pointless write.
      const patch = withUpdateSlugs(schemas.update.parse(values));

      const database = db(options);
      const current = await readOne(id, database);
      if (!current) return null;

      const changedFields = diffChangedFields(fieldNames, current, patch);

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
