import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq } from "drizzle-orm";

import type { PaginationCursorColumn } from "../../api/lib/with-pagination";
import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicListRow,
  ContentPublicOrderableFieldName,
  ContentPublicSelect,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentPageInfo } from "./service";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { ContentEngineError } from "../errors";
import { isContentReferenceCollection, splitContentFieldPath } from "../paths";
import { publicOrderableColumns } from "../registry";
import { groupPublicLeafPaths } from "../schemas";
import { createContentPublicRowHydrator } from "./public-row-hydration";
import { publicationColumns, publishedCondition } from "./publication";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
} from "./query";

/** Where the row nesting lives now. Re-exported so its path is unchanged. */
export { nestContentPublicRow } from "./public-row-hydration";

export interface ContentPublicReadOptions {
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
  /** Raw pagination query (`cursor`, `first`, `last`, `page`, `search`). */
  query?: {
    cursor?: string;
    first?: string;
    last?: string;
    page?: string;
    search?: string;
  };
}

export interface ContentPublicService<TDefinition> {
  /** `null` unless the row exists *and* is published. */
  findById: (
    id: number,
    options?: ContentPublicReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;

  findBySlug: (
    slug: string,
    options?: ContentPublicReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;
  findMany: (args?: ContentPublicFindManyArgs<TDefinition>) => Promise<{
    edges: ContentPublicListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;
}

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
  const flat = exposed.filter(name => splitContentFieldPath(name) === null);
  // A `user` field is never exposable, so this is only ever relations.
  const exposedToOne = new Set(
    flat.filter(
      name =>
        definition.fields[name]?.kind === "relation" &&
        !isContentReferenceCollection(definition.fields[name]),
    ),
  );
  const exposedToMany = new Set(
    flat.filter(
      name =>
        definition.fields[name] !== undefined &&
        isContentReferenceCollection(definition.fields[name]),
    ),
  );
  // Leaf-level privacy, resolved once: `seo` carries only the leaves the
  // allowlist named, whatever else the group declares.
  const containers = [...groupPublicLeafPaths(exposed)].map(
    ([owner, leaves]) => ({
      leaves,
      owner,
      repeatable: definition.fields[owner]?.kind === "repeatable",
    }),
  );

  return row => {
    const projected: Record<string, unknown> = {};

    for (const name of flat) {
      if (exposedToMany.has(name)) {
        const ids = row[name];
        projected[name] = Array.isArray(ids) ? ids : [];
        continue;
      }

      if (!exposedToOne.has(name)) {
        projected[name] = row[name];
        continue;
      }

      const id = row[name];
      projected[name] = typeof id === "number" ? { id } : null;
    }

    for (const { leaves, owner, repeatable } of containers) {
      const value = row[owner];

      if (repeatable) {
        projected[owner] = Array.isArray(value)
          ? (value as Record<string, unknown>[]).map(child => ({
              id: child.id,
              ...pick(child, leaves),
            }))
          : [];
        continue;
      }

      projected[owner] =
        value === null || value === undefined
          ? null
          : pick(value as Record<string, unknown>, leaves);
    }

    if (exposesId) projected.id = row.id;

    return projected as ContentPublicSelect<TDefinition>;
  };
};

const pick = (
  values: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(keys.map(key => [key, values[key] ?? null]));

export const contentPublicSelection = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): Record<string, PgColumn> => ({
  id: columns.id,
  ...Object.fromEntries(
    definition.publicApi.fields
      // A collection has no column, and a repeatable leaf is a column on a
      // child table - both are batch-loaded after the page is fetched. A group
      // leaf *is* a column, and `contentTableColumns` registers it under its
      // canonical path, so `columns["seo.title"]` resolves here.
      .filter(name => {
        const path = splitContentFieldPath(name);
        const owner = path ? path[0] : name;
        const fieldValue = definition.fields[owner];

        if (!fieldValue) return true;
        if (fieldValue.kind === "repeatable") return false;

        return !isContentReferenceCollection(fieldValue);
      })
      .map(name => [name, columns[name]]),
  ),
});

export const contentPublicCollectionFields = (
  definition: AnyContentTypeDefinition,
): string[] => {
  const named = new Set(
    definition.publicApi.fields.map(name => {
      const path = splitContentFieldPath(name);

      return path ? path[0] : name;
    }),
  );

  return [...named].filter(name => {
    const fieldValue = definition.fields[name];

    return (
      fieldValue !== undefined &&
      (fieldValue.kind === "repeatable" ||
        isContentReferenceCollection(fieldValue))
    );
  });
};

/** Public pages are smaller than admin ones, and the cap is lower too. */
export const clampContentPublicPageSize = (
  value: string | undefined,
): string | undefined => {
  if (value === undefined) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return value;

  return String(Math.min(parsed, CONTENT_PUBLIC_MAX_PAGE_SIZE));
};

export const createContentPublicService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  advanced,
  c,
  columns,
  definition,
  table,
}: {
  /** The collection store, or nothing for a content type that declares none. */
  advanced?: ContentAdvancedStore;
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
  const primaryCursor = columns.id as PaginationCursorColumn;
  const searchColumns = publicApi.searchableFields.map(name => columns[name]);
  const orderable = publicOrderableColumns(definition);

  const selection = (): Record<string, PgColumn> =>
    contentPublicSelection(definition, columns);

  const project = createContentPublicProjector(definition);
  // Loaded only when the allowlist actually exposes one, so a public list joins
  // no junction and no child table unless a public response is made of them.
  const publicCollections = contentPublicCollectionFields(definition);

  const withCollections = createContentPublicRowHydrator({
    advanced,
    c,
    definition,
    publicCollections,
  });

  const readOne = async (
    condition: SQL,
  ): Promise<ContentPublicSelect<TDefinition> | null> => {
    const [row] = await c
      .get("db")
      .select(selection())
      .from(table)
      .where(and(publishedCondition(published), condition))
      .limit(1);

    if (!row) return null;

    const [projected] = await withCollections([row]);

    return project(projected);
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
          membership: advanced?.membershipCondition,
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
        query: async ({
          cursorSelection,
          limit,
          offset,
          orderBy: order,
          where,
        }) =>
          await c
            .get("db")
            // The cursor value is projected by this statement and stripped from
            // the row before `project` ever sees it, so the public allowlist is
            // unchanged: it is pagination's own column, not a field.
            .select({ ...selection(), ...cursorSelection })
            .from(table)
            .where(where)
            .orderBy(order)
            .limit(
              typeof limit === "number"
                ? Math.min(limit, CONTENT_PUBLIC_MAX_PAGE_SIZE + 1)
                : CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
            )
            .offset(offset),
      });

      return {
        edges: (await withCollections(data.edges)).map(project),
        pageInfo: data.pageInfo,
      };
    },
  };
};
