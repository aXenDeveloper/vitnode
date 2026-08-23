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
import { resolveContentPublicRowFiles } from "./files";
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

/**
 * The collection fields a public response actually needs.
 *
 * Empty unless the allowlist named one, which is what keeps a public list from
 * joining every junction and child table a content type happens to have.
 */
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

/**
 * Folds a row's flat leaf columns back into the nested shape.
 *
 * A public read selects `seo.title` as a column alias, so the raw row carries a
 * key with a dot in it. Nesting happens here rather than in the projector so the
 * projector stays the one place that decides *what* is public, and this stays
 * the one place that decides what it *looks like*.
 */
export const nestContentPublicRow = (
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const nested: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const path = splitContentFieldPath(key);
    if (!path) {
      nested[key] = value;
      continue;
    }

    const [owner, leaf] = path;
    const container = (nested[owner] as Record<string, unknown>) ?? {};
    container[leaf] = value;
    nested[owner] = container;
  }

  return nested;
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

  /**
   * Attaches the exposed collections to a page of rows.
   *
   * One batch per collection field for the whole page, keyed by the parent ids
   * the page already fetched - never one query per row.
   */
  const withCollections = async (
    rows: readonly Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> => {
    const nested = rows.map(nestContentPublicRow);
    if (nested.length === 0) return nested;

    const ids = nested
      .map(row => row.id)
      .filter((id): id is number => typeof id === "number");
    // Only the collections the allowlist actually exposes: querying a private
    // junction table to discard its rows afterwards is work with no answer
    // attached, and `publicCollections` is already exactly that list.
    const loaded =
      publicCollections.length === 0
        ? undefined
        : await advanced?.loadMany(ids, c.get("db"), publicCollections);

    const withCollectionValues =
      loaded === undefined
        ? nested
        : nested.map(row => ({
            ...row,
            ...(typeof row.id === "number" ? loaded.get(row.id) : undefined),
          }));

    // **After** the collections, not before: a `multiple: true` file field has no
    // column, so its identifiers only exist on the row once `loadMany` has put
    // them there. One batch for the whole page either way, and only for the file
    // fields the allowlist exposes. The identifier is replaced by the descriptor
    // here rather than in the projector, so the projector stays the one place
    // that decides *what* is public and this stays the one place that decides
    // what it looks like.
    return await resolveContentPublicRowFiles(
      c,
      definition,
      withCollectionValues,
    );
  };

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
        query: async ({ cursorSelection, limit, orderBy: order, where }) =>
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
            ),
      });

      return {
        edges: (await withCollections(data.edges)).map(project),
        pageInfo: data.pageInfo,
      };
    },
  };
};
