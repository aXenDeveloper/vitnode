import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, exists, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type {
  PaginationCursorColumn,
  PaginationCursorSelection,
} from "../../api/lib/with-pagination";
import type { AnyContentTypeDefinition, ContentPublicSelect } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentLanguage } from "./language-resolver";
import type { ContentPublicService } from "./public-service";

import { withPagination } from "../../api/lib/with-pagination";
import {
  CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { ContentEngineError } from "../errors";
import { partitionContentFields } from "../localization";
import { isContentReferenceCollection, splitContentFieldPath } from "../paths";
import { publicOrderableColumns } from "../registry";
import { resolveContentPublicRowFiles } from "./files";
import { findContentLanguage } from "./language-resolver";
import {
  clampContentPublicPageSize,
  contentPublicCollectionFields,
  createContentPublicProjector,
  nestContentPublicRow,
} from "./public-service";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
} from "./query";

const LANGUAGE_KEY = "_languageId";

const conditions = (...parts: (SQL | undefined)[]): SQL | undefined => {
  const present = parts.filter((part): part is SQL => part !== undefined);
  if (present.length === 0) return undefined;

  return present.length === 1 ? present[0] : and(...present);
};

const anyOf = (...parts: (SQL | undefined)[]): SQL | undefined => {
  const present = parts.filter((part): part is SQL => part !== undefined);
  if (present.length === 0) return undefined;

  return present.length === 1 ? present[0] : or(...present);
};

/** The one or two languages one public read touches. */
interface ResolvedLocale {
  /** The default language, when this read is allowed to fall back to it. */
  fallbackTo: ContentLanguage | null;
  requested: ContentLanguage;
}

const EMPTY_PAGE = {
  count: 0,
  endCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  totalCount: 0,
};

export const createContentLocalizedPublicService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  advanced,
  c,
  columns,
  definition,
  table,
  translationColumns,
  translationTable,
}: {
  /** The collection store, or nothing for a content type that declares none. */
  advanced?: ContentAdvancedStore;
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  table: PgTableWithColumns<TableConfig>;
  translationColumns: Record<string, PgColumn>;
  translationTable: PgTable;
}): ContentPublicService<TDefinition> => {
  const contentTypeId = definition.id;
  const publicApi = definition.publicApi;
  const localization = definition.localization;

  if (!publicApi.enabled || !localization.enabled) {
    throw new ContentEngineError(
      "The localized public service needs both `publicApi: { enabled: true, path, fields }` and `localization: { enabled: true, defaultLocale }`.",
      { contentTypeId },
    );
  }

  const { collectionFields, localizedFields, sharedFields } =
    partitionContentFields(definition.fields);
  const isLocalized = (name: string): boolean =>
    localizedFields[name] !== undefined;

  const basePublication = publicationColumns(definition, columns);
  const translationPublication = contentTranslationPublicationColumns(
    definition,
    translationColumns,
  );

  const primaryCursor = columns.id as PaginationCursorColumn;
  const orderable = publicOrderableColumns(definition);
  const project = createContentPublicProjector(definition);

  const ownerOf = (name: string): string => {
    const path = splitContentFieldPath(name);

    return path ? path[0] : name;
  };
  const isColumnField = (name: string): boolean => {
    const fieldValue = definition.fields[ownerOf(name)];

    if (!fieldValue) return true;
    if (fieldValue.kind === "repeatable") return false;

    return !isContentReferenceCollection(fieldValue);
  };
  const exposedColumns = publicApi.fields.filter(isColumnField);
  const exposedShared = exposedColumns.filter(
    name => !isLocalized(ownerOf(name)),
  );
  const exposedLocalized = exposedColumns.filter(name =>
    isLocalized(ownerOf(name)),
  );
  const publicCollections = contentPublicCollectionFields(definition);
  const localizedColumnByPath = new Map(
    definition.advanced.leaves
      .filter(leaf => leaf.localized)
      .map(leaf => [leaf.path, leaf.columnName]),
  );

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
  const sharedSearchable = publicApi.searchableFields.filter(
    name => !isLocalized(ownerOf(name)),
  );
  const localizedSearchable = publicApi.searchableFields.filter(name =>
    isLocalized(ownerOf(name)),
  );

  // Two aliases of the same table, because one statement reads it twice: the
  // language the reader asked for, and the one it may fall back to. Named rather
  // than positional so the generated SQL stays legible in a slow-query log.
  const requestedTable = alias(translationTable, "vn_locale");
  const fallbackTable = alias(translationTable, "vn_fallback");
  const requestedRows = requestedTable as unknown as Record<string, PgColumn>;
  const fallbackRows = fallbackTable as unknown as Record<string, PgColumn>;

  const publishedTranslation = (languageId: number, extra?: SQL): SQL =>
    exists(
      c
        .get("db")
        .select({ one: sql`1` })
        .from(translationTable)
        .where(
          conditions(
            eq(translationColumns.itemId, columns.id),
            eq(translationColumns.languageId, languageId),
            publishedCondition(translationPublication),
            extra,
          ),
        ),
    );

  const visibleIn = (
    { fallbackTo, requested }: ResolvedLocale,
    extra?: SQL,
  ): SQL | undefined => {
    const direct = publishedTranslation(requested.id, extra);
    if (!fallbackTo) return direct;

    return anyOf(
      direct,
      conditions(
        not(publishedTranslation(requested.id)),
        publishedTranslation(fallbackTo.id, extra),
      ),
    );
  };

  const joinOn = (
    rows: Record<string, PgColumn>,
    languageId: number,
  ): SQL | undefined =>
    conditions(
      eq(rows.itemId, columns.id),
      eq(rows.languageId, languageId),
      publishedCondition({
        publishedAt: rows.publishedAt,
        status: rows.status,
      }),
    );

  const translationColumnName = (name: string): string =>
    localizedColumnByPath.get(name) ?? name;

  const localizedValue = (
    name: string,
    withFallback: boolean,
  ): PgColumn | SQL => {
    const column = translationColumnName(name);

    return withFallback
      ? sql`case when ${requestedRows.itemId} is not null then ${requestedRows[column]} else ${fallbackRows[column]} end`
      : requestedRows[column];
  };

  const selection = (
    withFallback: boolean,
  ): Record<string, PgColumn | SQL> => ({
    id: columns.id,
    // Shared values off the base row - including `createdAt`, `updatedAt` and
    // `publishedAt`, which on a public response mean "this published thing", not
    // "this translation row". A reader has no notion of a translation to
    // attribute a timestamp to.
    ...Object.fromEntries(exposedShared.map(name => [name, columns[name]])),
    ...Object.fromEntries(
      exposedLocalized.map(name => [name, localizedValue(name, withFallback)]),
    ),
    [LANGUAGE_KEY]: withFallback
      ? sql<number>`case when ${requestedRows.itemId} is not null then ${requestedRows.languageId} else ${fallbackRows.languageId} end`
      : requestedRows.languageId,
  });

  /**
   * Turns a locale into the one or two languages this read touches.
   *
   * `null` - not a throw - for a locale that names no language or one the install
   * has switched off. A public reader gets the same 404 as for a record that does
   * not exist: which locales an install serves is not something an anonymous
   * request needs to learn, and a `ContentLanguageError` escaping here would put a
   * raw engine message on a public route.
   *
   * The fallback language is resolved from the database too, never assumed from
   * `defaultLocale`: whether that string names a usable row is a fact about the
   * installation, and the boot guard is what reports it properly.
   */
  const resolveLocale = async (
    locale: string | undefined,
  ): Promise<null | ResolvedLocale> => {
    const requested = await findContentLanguage(
      c,
      locale ?? localization.defaultLocale,
    );
    if (!requested?.isEnabled) return null;

    if (localization.fallback !== "default") {
      return { fallbackTo: null, requested };
    }

    const defaultLanguage = await findContentLanguage(
      c,
      localization.defaultLocale,
    );
    if (!defaultLanguage || defaultLanguage.id === requested.id) {
      return { fallbackTo: null, requested };
    }

    return { fallbackTo: defaultLanguage, requested };
  };

  const projectRow = (
    row: Record<string, unknown>,
    { fallbackTo, requested }: ResolvedLocale,
  ): ContentPublicSelect<TDefinition> => ({
    ...project(row),
    // The language this row is actually in, which is not always the one that
    // was asked for. Without it a reader cannot tell a Polish article from an
    // English one served through the fallback - and `hreflang`, a language
    // switcher and a "not translated yet" notice all need that distinction.
    locale:
      fallbackTo !== null && row[LANGUAGE_KEY] === fallbackTo.id
        ? fallbackTo.locale
        : requested.locale,
  });

  /**
   * Runs one read with the translation join attached.
   *
   * The two branches are kept separate rather than folded into a conditional
   * join, because the shapes are genuinely different: without a fallback the join
   * is `INNER` and a row with no published translation in the requested language
   * is not in the result at all, and with one it is two `LEFT` joins so the `CASE`
   * has something to choose between. The `WHERE` has already excluded the rows
   * where neither matched.
   */
  const read = async (
    scope: ResolvedLocale,
    where: SQL | undefined,
    {
      cursorSelection,
      limit,
      order,
    }: {
      /** Only a paginated read asks for one; a single read has nothing to mint. */
      cursorSelection?: PaginationCursorSelection;
      limit: number;
      order?: SQL;
    },
  ): Promise<Record<string, unknown>[]> => {
    const query = c
      .get("db")
      .select({ ...selection(scope.fallbackTo !== null), ...cursorSelection })
      .from(table);

    if (!scope.fallbackTo) {
      const scoped = query
        .innerJoin(requestedTable, joinOn(requestedRows, scope.requested.id))
        .where(where);

      return order
        ? await scoped.orderBy(order).limit(limit)
        : await scoped.limit(limit);
    }

    const scoped = query
      .leftJoin(requestedTable, joinOn(requestedRows, scope.requested.id))
      .leftJoin(fallbackTable, joinOn(fallbackRows, scope.fallbackTo.id))
      .where(where);

    return order
      ? await scoped.orderBy(order).limit(limit)
      : await scoped.limit(limit);
  };

  const readOne = async (
    resolved: ResolvedLocale,
    condition: SQL | undefined,
    { strict = false }: { strict?: boolean } = {},
  ): Promise<ContentPublicSelect<TDefinition> | null> => {
    // A strict read must not fall back - `findBySlug`. Dropping the fallback
    // language makes the join inner and the visibility test single-armed, so
    // there is no arm left that could resolve another language.
    const scope: ResolvedLocale = strict
      ? { fallbackTo: null, requested: resolved.requested }
      : resolved;

    const [row] = await read(
      scope,
      conditions(
        publishedCondition(basePublication),
        visibleIn(scope),
        condition,
      ),
      { limit: 1 },
    );

    if (!row) return null;

    const [withAdvanced] = await withCollections([row]);

    return projectRow(withAdvanced, scope);
  };

  return {
    findById: async (id, options) => {
      const resolved = await resolveLocale(options?.locale);
      if (!resolved) return null;

      return await readOne(resolved, eq(columns.id, id));
    },

    findBySlug: async (slug, options) => {
      const resolved = await resolveLocale(options?.locale);
      if (!resolved) return null;

      const slugField = publicApi.slugField;

      // A localized slug is matched inside the translation, a shared one on the
      // base row. Both are strict: the fallback language is not consulted either
      // way, so a URL always resolves in the language it was published under.
      const condition = isLocalized(slugField)
        ? publishedTranslation(
            resolved.requested.id,
            eq(translationColumns[slugField], slug),
          )
        : eq(columns[slugField], slug);

      return await readOne(resolved, condition, { strict: true });
    },

    findMany: async ({ filters = {}, locale, orderBy, query = {} } = {}) => {
      const resolved = await resolveLocale(locale);
      if (!resolved) return { edges: [], pageInfo: EMPTY_PAGE };

      const raw = filters as Record<string, unknown>;
      const sharedFilters = Object.fromEntries(
        Object.entries(raw).filter(([name]) => !isLocalized(ownerOf(name))),
      );
      const localizedFilters = Object.fromEntries(
        Object.entries(raw).filter(([name]) => isLocalized(ownerOf(name))),
      );

      const term = query.search;
      const sharedSearch = buildSearchCondition(
        sharedSearchable.map(name => columns[name]),
        term,
      );
      const localizedSearch = buildSearchCondition(
        localizedSearchable.map(name => translationColumns[name]),
        term,
      );

      const where = conditions(
        // Not optional, not a parameter, and first: whatever else a caller
        // passes, an unpublished record cannot come back.
        publishedCondition(basePublication),
        // The localized filter goes through the same visibility test as the read
        // itself, so a filter can only ever match the translation the reader
        // would actually be shown.
        visibleIn(
          resolved,
          buildFilterCondition({
            allowed: publicApi.filterableFields,
            columns: translationColumns,
            contentTypeId,
            fields: localizedFields,
            filters: localizedFilters,
          }),
        ),
        buildFilterCondition({
          allowed: publicApi.filterableFields,
          columns,
          contentTypeId,
          fields: { ...collectionFields, ...sharedFields },
          filters: sharedFilters,
          membership: advanced?.membershipCondition,
        }),
        anyOf(
          sharedSearch,
          localizedSearch === undefined
            ? undefined
            : visibleIn(resolved, localizedSearch),
        ),
      );

      const data = await withPagination({
        c,
        params: {
          query: {
            ...query,
            first: clampContentPublicPageSize(query.first),
            last: clampContentPublicPageSize(query.last),
            // Folded into `where` above so the term is escaped and so it can
            // reach the translation table at all; handing it to `withPagination`
            // would build an unescaped `ilike` over base columns only.
            search: undefined,
          },
        },
        primaryCursor,
        // Ordering is a base-table column by construction:
        // `publicApi.orderableFields` refuses a localized field, because a page
        // ordered by a localized title would reshuffle itself for every language
        // and paginate inconsistently across a fallback set.
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
        where,
        query: async ({
          cursorSelection,
          limit,
          orderBy: order,
          where: paged,
        }) =>
          await read(resolved, paged, {
            cursorSelection,
            limit:
              typeof limit === "number"
                ? Math.min(limit, CONTENT_PUBLIC_MAX_PAGE_SIZE + 1)
                : CONTENT_PUBLIC_DEFAULT_PAGE_SIZE,
            order,
          }),
      });

      return {
        edges: (await withCollections(data.edges)).map(row =>
          projectRow(row, resolved),
        ),
        pageInfo: data.pageInfo,
      };
    },
  };
};
