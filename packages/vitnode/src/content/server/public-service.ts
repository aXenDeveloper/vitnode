import type { ColumnBaseConfig, SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicListRow,
  ContentPublicOrderableFieldName,
  ContentPublicSelect,
} from "../types";
import type { ContentPageInfo } from "./service";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { ContentEngineError } from "../errors";
import { publicOrderableColumns } from "../registry";
import { publicationColumns, publishedCondition } from "./publication";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
} from "./query";
import { LABEL_PREFIX, resolveReferenceTargets, toLabel } from "./references";

export interface ContentPublicFindManyArgs<TDefinition> {
  /** Equality filters, restricted to `publicApi.filterableFields`. */
  filters?: ContentPublicFilterInput<TDefinition>;
  orderBy?: {
    column?: ContentPublicOrderableFieldName<TDefinition>;
    order?: "asc" | "desc";
  };
  /** Raw pagination query (`cursor`, `first`, `last`, `search`). */
  query?: { cursor?: string; first?: string; last?: string; search?: string };
}

/**
 * The read-only half of a content type, for anonymous callers.
 *
 * There is no `create`, `update`, `delete`, `publish` or `unpublish` to omit -
 * this is a different object from `model.service`, not a filtered view of it,
 * so a public write is not something you can reach by accident.
 */
export interface ContentPublicService<TDefinition> {
  /** `null` unless the row exists *and* is published. */
  findById: (id: number) => Promise<ContentPublicSelect<TDefinition> | null>;
  /** The public detail lookup. `null` for a draft, an unpublished row or a typo. */
  findBySlug: (
    slug: string,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;
  findMany: (args?: ContentPublicFindManyArgs<TDefinition>) => Promise<{
    edges: ContentPublicListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
}

/** Public pages are smaller than admin ones, and the cap is lower too. */
const clampPageSize = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return value;

  return String(Math.min(parsed, CONTENT_PUBLIC_MAX_PAGE_SIZE));
};

/**
 * Builds the read-only service a public route serves from.
 *
 * Two things make this safe rather than "the admin service with fewer methods":
 *
 * 1. **The published predicate is not a parameter.** Every method `and`s it in
 *    itself, so there is no argument a caller could forget and no code path
 *    that reaches an unpublished row.
 * 2. **The `SELECT` is built from `publicApi.fields`.** A private column is
 *    never fetched, so it cannot be leaked by a mistake further downstream.
 *    The one exception is `id`, which the cursor needs; it is dropped from the
 *    projected row unless the allowlist names it, and that boundary is tested.
 */
export const createContentPublicService = <
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
}): ContentPublicService<TDefinition> => {
  const contentTypeId = definition.id;
  const publicApi = definition.publicApi;

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "This content type has no public API. Add `publicApi: { enabled: true, path, fields }` to generate one.",
      { contentTypeId },
    );
  }

  const fields = definition.fields;
  // `publicApi` cannot be enabled without publication, so this never throws
  // here - it is what turns the erased column map into the two columns the
  // predicate needs.
  const published = publicationColumns(definition, columns);
  const primaryCursor = columns.id as PgColumn<
    ColumnBaseConfig<"number", string>
  >;
  const references = resolveReferenceTargets(definition, table, columns);
  const exposed = publicApi.fields;
  const exposesId = exposed.includes("id");
  // Only the relations the allowlist names: a `user` field is never exposable,
  // and an unexposed relation should not cost a join either.
  const exposedRelations = exposed.filter(
    name => fields[name]?.kind === "relation" && references[name],
  );
  const searchColumns = publicApi.searchableFields.map(name => columns[name]);
  const orderable = publicOrderableColumns(definition);

  /** Own columns, plus `id` for the cursor whether or not it is exposed. */
  const selection = (): Record<string, PgColumn> => ({
    id: primaryCursor,
    ...Object.fromEntries(exposed.map(name => [name, columns[name]])),
    ...Object.fromEntries(
      exposedRelations.map(name => [
        `${LABEL_PREFIX}${name}`,
        references[name].labelColumn,
      ]),
    ),
  });

  /**
   * Turns one raw row into the public projection: relations collapse to
   * `{ id, label }`, the label columns disappear, and `id` goes with them
   * unless it was asked for.
   */
  const project = (
    row: Record<string, unknown>,
  ): ContentPublicSelect<TDefinition> => {
    const projected: Record<string, unknown> = {};

    for (const name of exposed) {
      if (!exposedRelations.includes(name)) {
        projected[name] = row[name];
        continue;
      }

      const id = row[name];
      projected[name] =
        typeof id === "number"
          ? { id, label: toLabel(row[`${LABEL_PREFIX}${name}`]) }
          : null;
    }

    if (exposesId) projected.id = row.id;

    return projected as ContentPublicSelect<TDefinition>;
  };

  const readOne = async (
    condition: SQL,
  ): Promise<ContentPublicSelect<TDefinition> | null> => {
    let builder = c.get("db").select(selection()).from(table).$dynamic();

    for (const name of exposedRelations) {
      const target = references[name];
      builder = builder.leftJoin(
        target.aliased,
        eq(target.owner, target.idColumn),
      );
    }

    const [row] = await builder
      .where(and(publishedCondition(published), condition))
      .limit(1);

    return row ? project(row) : null;
  };

  return {
    findById: async id => await readOne(eq(primaryCursor, id)),

    findBySlug: async slug =>
      await readOne(eq(columns[publicApi.slugField], slug)),

    findMany: async ({ filters = {}, orderBy, query = {} } = {}) => {
      const conditions = [
        // Not optional, not a parameter, and first: whatever else a caller
        // passes, an unpublished row cannot come back.
        publishedCondition(published),
        buildFilterCondition({
          allowed: publicApi.filterableFields,
          columns,
          contentTypeId,
          fields,
          filters,
        }),
        buildSearchCondition(searchColumns, query.search),
      ].filter((item): item is SQL => item !== undefined);

      const data = await withPagination({
        c,
        params: {
          query: {
            ...query,
            first: clampPageSize(query.first),
            last: clampPageSize(query.last),
            // Folded into `where` above so the term is escaped; handing it to
            // `withPagination` would build an unescaped `ilike`.
            search: undefined,
          },
        },
        primaryCursor,
        orderBy: {
          column: buildOrderColumn({
            columns,
            contentTypeId,
            fallback: publicApi.defaultOrderBy,
            orderBy: orderBy?.column,
            orderable,
          }),
          order: orderBy?.order ?? publicApi.defaultOrder,
        },
        table,
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
        query: async ({ limit, orderBy: order, where }) => {
          let builder = c.get("db").select(selection()).from(table).$dynamic();

          for (const name of exposedRelations) {
            const target = references[name];
            builder = builder.leftJoin(
              target.aliased,
              eq(target.owner, target.idColumn),
            );
          }

          return await builder
            .where(where)
            .orderBy(order)
            .limit(
              typeof limit === "number"
                ? Math.min(limit, CONTENT_PUBLIC_MAX_PAGE_SIZE + 1)
                : CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
            );
        },
      });

      return { edges: data.edges.map(project), pageInfo: data.pageInfo };
    },
  };
};
