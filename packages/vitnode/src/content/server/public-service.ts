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

/**
 * Which language a public read is for.
 *
 * Ignored by a content type that is not localized - there is one version of the
 * row and it is the answer to every locale. Present on the shared interface
 * rather than only on the localized one so a route handler, which is written
 * against `AnyContentTypeDefinition` and cannot know which it was handed, passes
 * the locale unconditionally and lets the service decide whether it means
 * anything.
 */
export interface ContentPublicReadOptions {
  /**
   * The **canonical** locale this read is for, already resolved through
   * `resolveContentPublicLocale`.
   *
   * A locale that names no language, or one the install has switched off, is a
   * `null` result rather than a throw or a silent substitution: the caller answers
   * the same 404 it answers for a slug that does not exist, and no reader is ever
   * handed a language they did not ask for.
   */
  locale?: string;
}

export interface ContentPublicFindManyArgs<
  TDefinition,
> extends ContentPublicReadOptions {
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
  findById: (
    id: number,
    options?: ContentPublicReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;
  /**
   * The public detail lookup. `null` for a draft, an unpublished row or a typo.
   *
   * **Never falls back.** A slug belongs to one language, so resolving a Polish
   * URL against an English translation would answer a request for `/pl/witaj`
   * with the English article - and then cache it under the Polish tag. See
   * `createContentLocalizedPublicService`.
   */
  findBySlug: (
    slug: string,
    options?: ContentPublicReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;
  findMany: (args?: ContentPublicFindManyArgs<TDefinition>) => Promise<{
    edges: ContentPublicListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
}

/**
 * The public projection, as a standalone function.
 *
 * Extracted so the preview route can use **this** rather than a second
 * implementation that looks the same on the day it is written. The allowlist,
 * the relation-to-`{ id }` collapse and the "drop the cursor `id` unless it was
 * exposed" rule are one piece of code, so a field cannot become public on one
 * route and stay private on the other.
 *
 * It reads nothing but the definition: no database handle, no columns, no
 * joins. An exposed relation is projected from the foreign key the row already
 * carries, which is what makes it impossible for one content type's allowlist
 * to publish another's administrative metadata.
 */
export const createContentPublicProjector = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
): ((row: Record<string, unknown>) => ContentPublicSelect<TDefinition>) => {
  const publicApi = definition.publicApi;

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "This content type has no public API, so there is no public projection to build.",
      { contentTypeId: definition.id },
    );
  }

  const exposed = publicApi.fields;
  const exposesId = exposed.includes("id");
  // A `user` field is never exposable, so this is only ever relations.
  const exposedRelations = new Set(
    exposed.filter(name => definition.fields[name]?.kind === "relation"),
  );

  return row => {
    const projected: Record<string, unknown> = {};

    for (const name of exposed) {
      if (!exposedRelations.has(name)) {
        projected[name] = row[name];
        continue;
      }

      const id = row[name];
      projected[name] = typeof id === "number" ? { id } : null;
    }

    if (exposesId) projected.id = row.id;

    return projected as ContentPublicSelect<TDefinition>;
  };
};

/**
 * The columns a public read selects: the allowlist, plus `id` for the cursor.
 *
 * `id` is fetched whether or not it is exposed, because pagination needs it -
 * and then dropped again by the projector. A private column is never in this
 * map at all, so it cannot leak through a mistake further downstream.
 */
export const contentPublicSelection = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): Record<string, PgColumn> => ({
  id: columns.id,
  ...Object.fromEntries(
    definition.publicApi.fields.map(name => [name, columns[name]]),
  ),
});

/** Public pages are smaller than admin ones, and the cap is lower too. */
export const clampContentPublicPageSize = (
  value: string | undefined,
): string | undefined => {
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
 *
 * It also joins nothing. An exposed relation is projected from the foreign key
 * the row already carries, so a target table is never read - which is what
 * makes it impossible for one content type's allowlist to publish another's
 * administrative metadata.
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
  const searchColumns = publicApi.searchableFields.map(name => columns[name]);
  const orderable = publicOrderableColumns(definition);

  const selection = (): Record<string, PgColumn> =>
    contentPublicSelection(definition, columns);

  const project = createContentPublicProjector(definition);

  const readOne = async (
    condition: SQL,
  ): Promise<ContentPublicSelect<TDefinition> | null> => {
    const [row] = await c
      .get("db")
      .select(selection())
      .from(table)
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
            first: clampContentPublicPageSize(query.first),
            last: clampContentPublicPageSize(query.last),
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
        query: async ({ limit, orderBy: order, where }) =>
          await c
            .get("db")
            .select(selection())
            .from(table)
            .where(where)
            .orderBy(order)
            .limit(
              typeof limit === "number"
                ? Math.min(limit, CONTENT_PUBLIC_MAX_PAGE_SIZE + 1)
                : CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
            ),
      });

      return { edges: data.edges.map(project), pageInfo: data.pageInfo };
    },
  };
};
