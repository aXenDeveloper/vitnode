import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { PaginationCursorColumn } from "../../api/lib/with-pagination";
import type { ContentIdOf } from "../ids";
import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicListRow,
  ContentPublicOrderableFieldName,
  ContentPublicSelect,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type {
  ContentPublicHiddenAccess,
  ContentPublicHiddenFlag,
} from "./hidden-list";
import type { ContentPageInfo } from "./service";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { ContentEngineError } from "../errors";
import { contentRelationStrategy, parseContentId } from "../ids";
import { isContentReferenceCollection, splitContentFieldPath } from "../paths";
import { isContentPublicPerson } from "../public-person";
import { publicOrderableColumns } from "../registry";
import { groupPublicLeafPaths } from "../schemas";
import {
  contentPublicListCondition,
  flagHiddenContentRows,
} from "./hidden-list";
import { createContentParentVisibility } from "./parent-visibility";
import {
  createContentPublicRowHydrator,
  isContentPublicPeopleList,
} from "./public-row-hydration";
import {
  contentPublicReadCondition,
  publicationColumns,
  publishedCondition,
} from "./publication";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
} from "./query";

/** Where the row nesting lives now. Re-exported so its path is unchanged. */
export { nestContentPublicRow } from "./public-row-hydration";

export interface ContentPublicReadOptions {
  /** Language to read, on a localized content type. Defaults to `localization.defaultLocale`. */
  locale?: string;
}

export interface ContentPublicItemReadOptions extends ContentPublicReadOptions {
  /**
   * Read a published record a moderator has *hidden*, instead of a visible
   * one. Defaults to `false`.
   */
  hidden?: boolean;
  /**
   * Only these exposed fields, and no `publicApi.people` - for an internal
   * caller that reads a handful of keys, such as delivery metadata or an
   * existence check. A name outside `publicApi.fields` is ignored, so this can
   * never widen the projection. The return type does not narrow with it.
   */
  select?: readonly string[];
}

export interface ContentPublicSlugReadOptions extends ContentPublicItemReadOptions {
  /**
   * On a localized content type with `fallback: "default"`, also match the
   * slug of the default-language translation when the requested language has
   * none.
   */
  fallback?: boolean;
}

export interface ContentPublicFindManyArgs<
  TDefinition,
> extends ContentPublicReadOptions {
  /** Equality filters, restricted to `publicApi.filterableFields`. */
  filters?: ContentPublicFilterInput<TDefinition>;
  /**
   * Also list the published-but-hidden records this viewer may see, flagged
   * `hidden: true`. Per viewer, so never cache such a page for everybody.
   */
  hidden?: ContentPublicHiddenAccess;
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

/**
 * Public reads of one content type, from `model.publicService(c)`.
 * Server-only.
 *
 * Every read returns the {@link ContentPublicSelect} projection - only the
 * `publicApi.fields` allowlist ever leaves the database - and only records that
 * are published, with `publishedAt` in the past, and not hidden (unless
 * `hidden: true` asks for hidden ones).
 */
export interface ContentPublicService<TDefinition> {
  /** `null` unless the row exists *and* is published. */
  findById: (
    id: ContentIdOf<TDefinition>,
    options?: ContentPublicItemReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;

  /** The published record answering to `slug`, or `null`. */
  findBySlug: (
    slug: string,
    options?: ContentPublicSlugReadOptions,
  ) => Promise<ContentPublicSelect<TDefinition> | null>;
  /** One page of published records, filtered and ordered within the public allowlists. */
  findMany: (args?: ContentPublicFindManyArgs<TDefinition>) => Promise<{
    edges: (ContentPublicHiddenFlag & ContentPublicListRow<TDefinition>)[];
    pageInfo: ContentPageInfo;
  }>;
  /**
   * The published rows among `ids`, in no particular order - for a caller that
   * already knows which records it wants, such as a thread. Unpublished and
   * hidden ids are simply missing. Not available on localized content types.
   */
  findManyByIds?: (
    ids: readonly ContentIdOf<TDefinition>[],
  ) => Promise<ContentPublicSelect<TDefinition>[]>;
}

/**
 * Which exposed fields and people one read projects.
 *
 * The detail response is every `publicApi.fields` entry; a list row may be a
 * subset of it (`publicApi.listFields`), and an internal read a smaller one
 * still. Always a subset: nothing here can name a field the allowlist does not.
 */
export interface ContentPublicProjection {
  fields: readonly string[];
  people: readonly string[];
}

export const contentPublicDetailProjection = (
  definition: AnyContentTypeDefinition,
): ContentPublicProjection => ({
  fields: definition.publicApi.fields,
  people: definition.publicApi.people,
});

export const contentPublicListProjection = (
  definition: AnyContentTypeDefinition,
): ContentPublicProjection => ({
  fields: definition.publicApi.listFields ?? definition.publicApi.fields,
  people: definition.publicApi.people,
});

/** The projection {@link ContentPublicItemReadOptions.select} asks for. */
export const contentPublicSelectProjection = (
  definition: AnyContentTypeDefinition,
  select: readonly string[],
): ContentPublicProjection => {
  const selected = new Set(select);

  return {
    fields: definition.publicApi.fields.filter(name => selected.has(name)),
    people: [],
  };
};

/**
 * The function that turns a selected row into a content type's public shape:
 * only the fields and people `projection` names (by default every
 * `publicApi.fields` and `publicApi.people` entry; to-one relations as `{ id }`,
 * to-many as ids, people as hydrated summaries), never other columns. Resolve
 * files before projecting.
 *
 * @throws {ContentEngineError} When the content type has no `publicApi`.
 */
export const createContentPublicProjector = <
  TDefinition extends AnyContentTypeDefinition,
>(
  definition: TDefinition,
  projection: ContentPublicProjection = contentPublicDetailProjection(
    definition,
  ),
): ((row: Record<string, unknown>) => ContentPublicSelect<TDefinition>) => {
  const publicApi = definition.publicApi;

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "This content type has no public API, so there is no public projection to build.",
      { contentTypeId: definition.id },
    );
  }

  const exposed = projection.fields;
  const { people } = projection;
  const exposesId = exposed.includes("id");
  const flat = exposed.filter(name => splitContentFieldPath(name) === null);
  // A `user` field is never exposable, so this is only ever relations.
  const exposedToOne = new Map(
    flat.flatMap(name => {
      const fieldValue = definition.fields[name];

      return fieldValue?.kind === "relation" &&
        !isContentReferenceCollection(fieldValue)
        ? [[name, contentRelationStrategy(definition, fieldValue)] as const]
        : [];
    }),
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

      const strategy = exposedToOne.get(name);
      if (strategy === undefined) {
        projected[name] = row[name];
        continue;
      }

      const id = parseContentId(strategy, row[name]);
      projected[name] = id === null ? null : { id };
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

    // Only ever the hydrated summary: a bare user id that skipped hydration
    // is dropped rather than published.
    for (const name of people) {
      const person = row[name];

      if (isContentPublicPeopleList(definition, name)) {
        projected[name] = Array.isArray(person)
          ? person.filter(isContentPublicPerson)
          : [];
        continue;
      }

      projected[name] = isContentPublicPerson(person) ? person : null;
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

export const contentPublicPeopleColumnFields = (
  definition: AnyContentTypeDefinition,
  people: readonly string[],
): string[] =>
  people.filter(name => !isContentPublicPeopleList(definition, name));

/**
 * The columns a public read selects: `id`, the to-one `publicApi.people` user
 * ids (later swapped for public summaries) and the exposed field columns.
 */
export const contentPublicSelection = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
  projection: ContentPublicProjection = contentPublicDetailProjection(
    definition,
  ),
): Record<string, PgColumn> => ({
  id: columns.id,
  // The user ids behind the to-one `publicApi.people`; the hydrator swaps each
  // for a public summary and the projector never lets a bare id through.
  ...Object.fromEntries(
    contentPublicPeopleColumnFields(definition, projection.people).map(name => [
      name,
      columns[name],
    ]),
  ),
  ...Object.fromEntries(
    projection.fields
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
  fields: readonly string[] = definition.publicApi.fields,
): string[] => {
  const named = new Set(
    fields.map(name => {
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

/**
 * Builds the public read service of a non-localized content type. Plugins use the model's `publicService` factory instead,
 * which passes the right tables and columns.
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
      "This content type has no public API. Add `publicApi: { path, fields }` to generate one.",
      { contentTypeId },
    );
  }

  const fields = definition.fields;
  // `publicApi` cannot be enabled without publication, so this never throws
  // here - it is what turns the erased column map into the two columns the
  // predicate needs.
  const published = publicationColumns(definition, columns);
  const parent = createContentParentVisibility(c, definition, columns);
  const withParent = <TSelection extends object>(selection: TSelection) =>
    parent ? { ...selection, ...parent.selection } : selection;
  const keepVisible = async <TRow extends Record<string, unknown>>(
    rows: TRow[],
  ): Promise<TRow[]> => (parent ? await parent.visible(rows) : rows);
  const primaryCursor = columns.id as PaginationCursorColumn;
  const searchColumns = publicApi.searchableFields.map(name => columns[name]);
  const orderable = publicOrderableColumns(definition);

  /**
   * Everything one projection needs, built once: the `SELECT`, the hydrator and
   * the projector. Collections load only when the projection exposes one, so a
   * public list joins no junction and no child table unless a public response
   * is made of them.
   */
  const reader = (projection: ContentPublicProjection) => ({
    hydrate: createContentPublicRowHydrator({
      advanced,
      c,
      definition,
      people: projection.people,
      publicCollections: contentPublicCollectionFields(
        definition,
        projection.fields,
      ),
    }),
    project: createContentPublicProjector(definition, projection),
    selection: contentPublicSelection(definition, columns, projection),
  });

  const detail = reader(contentPublicDetailProjection(definition));
  const list = publicApi.listFields
    ? reader(contentPublicListProjection(definition))
    : detail;

  const readOne = async (
    condition: SQL,
    options: ContentPublicItemReadOptions = {},
  ): Promise<ContentPublicSelect<TDefinition> | null> => {
    const { hydrate, project, selection } = options.select
      ? reader(contentPublicSelectProjection(definition, options.select))
      : detail;
    const [row] = await keepVisible(
      await c
        .get("db")
        .select(withParent(selection))
        .from(table)
        .where(and(contentPublicReadCondition(published, options), condition))
        .limit(1),
    );

    if (!row) return null;

    const [projected] = await hydrate([row]);

    return project(projected);
  };

  return {
    findById: async (id, options) =>
      await readOne(eq(primaryCursor, id), options),

    findBySlug: async (slug, options) =>
      await readOne(eq(columns[publicApi.slugField], slug), options),

    findManyByIds: async ids => {
      if (ids.length === 0) return [];

      const rows = await keepVisible(
        await c
          .get("db")
          .select(withParent(detail.selection))
          .from(table)
          .where(
            and(
              publishedCondition(published),
              inArray(primaryCursor, [...ids]),
            ),
          ),
      );

      return (await detail.hydrate(rows)).map(detail.project);
    },

    findMany: async ({ filters = {}, hidden, orderBy, query = {} } = {}) => {
      const conditions = [
        contentPublicListCondition({ advanced, columns, definition }, hidden),
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
            .select({ ...withParent(list.selection), ...cursorSelection })
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

      const edges = (await list.hydrate(await keepVisible(data.edges))).map(
        list.project,
      );

      return {
        edges: hidden
          ? await flagHiddenContentRows(c, { columns, rows: edges, table })
          : edges,
        pageInfo: data.pageInfo,
      };
    },
  };
};
