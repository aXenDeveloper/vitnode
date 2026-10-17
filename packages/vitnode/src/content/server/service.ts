import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray, ne, or, sql } from "drizzle-orm";

import type { PaginationCursorColumn } from "../../api/lib/with-pagination";
import type { ContentId, ContentIdOf } from "../ids";
import type { ContentSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentAdvancedValues,
  ContentChangedPath,
  ContentCreateInput,
  ContentDetail,
  ContentFieldsOf,
  ContentFilterInput,
  ContentInnerFieldsOf,
  ContentLocalizedValues,
  ContentOrderableFieldName,
  ContentReferenceFieldName,
  ContentReferenceIdOf,
  ContentRelationCollectionName,
  ContentRepeatableFieldName,
  ContentRepeatableInputRow,
  ContentRepeatableRow,
  ContentSelect,
  ContentUpdateInput,
  ContentValuesOf,
} from "../types";
import type { ContentVisibilityAction } from "../visibility";
import type { ContentAdvancedStore } from "./advanced-store";
import type {
  ContentDuplicateTranslationSource,
  ContentDuplicationMethods,
} from "./duplicate";
import type { ContentPickerTarget } from "./references";
import type { ContentTranslationModel } from "./translation-model";
import type {
  ContentVisibilityMembers,
  ContentVisibilityMethods,
  ContentVisibilityOptions,
  ContentVisibilityResult,
} from "./visibility";

import { withPagination } from "../../api/lib/with-pagination";
import { cancelContentSubmissions } from "../approvals/server/submissions";
import {
  CONTENT_DEFAULT_PAGE_SIZE,
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_OPTIONS_LIMIT,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SYSTEM_FIELDS,
  CONTENT_VISIBILITY_FIELDS,
} from "../const";
import { resolveContentContainerAssignment } from "../containers/server/assignment";
import { ContentEngineError } from "../errors";
import { contentRelationStrategy, requireContentId } from "../ids";
import { partitionContentFields } from "../localization";
import { contentColumnsToValues, contentStorageColumns } from "../paths";
import { orderableColumns } from "../registry";
import {
  buildContentRelationOperations,
  buildContentRepeatableOperations,
  contentCollectionKinds,
} from "./collection-api";
import { runContentDuplicate } from "./duplicate";
import {
  assertContentFileReferences,
  contentFileCollectionFields,
} from "./files";
import { findContentLanguage } from "./language-resolver";
import {
  buildFilterCondition,
  buildOrderColumn,
  buildSearchCondition,
  changedPathsToColumns,
  diffChangedPaths,
  toInsertColumns,
} from "./query";
import {
  assertNoContentSelfReference,
  LABEL_PREFIX,
  resolveCollectionPickerTargets,
  resolveReferenceTargets,
  toLabel,
} from "./references";
import { createSlugNormalizer } from "./slugs";
import { assertContentThreadPlacement } from "./thread";
import {
  isInVisibilityState,
  visibilityChange,
  visibilityStateOf,
  visibilityValues,
} from "./visibility";

/** Display labels for `user` and `relation` values, keyed by field name. */
export type ContentLabels = Record<string, null | string>;

/** A list row: the base-table row plus display labels for its reference fields. */
export type ContentListRow<TDefinition> = ContentSelect<TDefinition> & {
  labels: ContentLabels;
};

/** Pagination metadata of a `findMany` page, cursor- or page-based. */
export interface ContentPageInfo {
  count: number;
  currentPage: null | number;

  endCursor: null | string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageSize: number;
  startCursor: null | string;
  totalCount: number;
  totalPages: number;
}

export interface ContentFindManyArgs<TDefinition> {
  /** Equality filters, keyed by filterable field name. */
  filters?: ContentFilterInput<TDefinition>;
  orderBy?: {
    column?: ContentOrderableFieldName<TDefinition>;
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
  where?: SQL;
}

export type ContentDatabase = Omit<Context["var"]["db"], "$client">;

export interface ContentServiceOptions {
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

/** A write's new row and the field paths whose value actually changed. */
export interface ContentUpdateResult<TDefinition> {
  changedFields: ContentChangedPath<TDefinition>[];
  row: ContentSelect<TDefinition>;
}

export interface ContentRelationMethods<TDefinition, TRelatedId = ContentId> {
  /** Adds one target. A target already present is a no-op. */
  add: (
    itemId: ContentIdOf<TDefinition>,
    relatedItemId: TRelatedId,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** The current targets, in stored order. */
  get: (
    itemId: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<TRelatedId[]>;
  /** Removes one target. A target that is not there is a no-op. */
  remove: (
    itemId: ContentIdOf<TDefinition>,
    relatedItemId: TRelatedId,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;

  reorder: (
    itemId: ContentIdOf<TDefinition>,
    relatedItemIds: readonly TRelatedId[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** Replaces the whole set. */
  set: (
    itemId: ContentIdOf<TDefinition>,
    relatedItemIds: readonly TRelatedId[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

export interface ContentRepeatableMethods<TDefinition, TName> {
  create: (
    itemId: ContentIdOf<TDefinition>,
    values: ContentValuesOf<ContentInnerFieldsOf<TDefinition, TName>>,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** Removes one child by its stable identifier. */
  delete: (
    itemId: ContentIdOf<TDefinition>,
    childId: number,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /** The current children, in position order, each with its identifier. */
  list: (
    itemId: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<
    ContentRepeatableRow<ContentInnerFieldsOf<TDefinition, TName>>[]
  >;
  /** Rearranges the existing children. Refuses a non-permutation. */
  reorder: (
    itemId: ContentIdOf<TDefinition>,
    childIds: readonly number[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;

  set: (
    itemId: ContentIdOf<TDefinition>,
    rows: readonly ContentRepeatableInputRow<
      ContentInnerFieldsOf<TDefinition, TName>
    >[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;

  update: (
    itemId: ContentIdOf<TDefinition>,
    childId: number,
    values: Partial<ContentValuesOf<ContentInnerFieldsOf<TDefinition, TName>>>,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

export type ContentWriteOptions = ContentServiceOptions;

export interface ContentPublicationResult<TDefinition> {
  /**
   * `false` when the row was already in that state: no write happened, no event
   * was emitted, and nothing needs invalidating.
   */
  changed: boolean;

  publishedAt: Date | null;
  row: ContentSelect<TDefinition>;
}

export interface ContentPublicationMethods<TDefinition> {
  /**
   * Idempotent. Stamps `publishedAt` on the first `draft -> published`
   * transition and never rewrites it. `null` when the row does not exist.
   */
  publish: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentPublicationResult<TDefinition> | null>;
  /** Idempotent. Flips `status` only - `publishedAt` is left alone. */
  unpublish: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentPublicationResult<TDefinition> | null>;
}

/**
 * The typed repository of one content type, from `model.service(c)`.
 * Server-only.
 *
 * Validates input against the generated schemas and writes the base table,
 * its junction and child tables. It is deliberately low level: it emits no
 * events, records no revisions and expires no caches - and neither does
 * `model.editorialService`. Custom write paths must follow up the way the
 * generated routes do: `emitContentEvent`, or `contentPlainWriteEffects` /
 * `contentEditorialEffects` after an `editorialService` write.
 *
 * Publication, visibility and duplication methods exist only when the
 * definition enables them.
 */
export type ContentService<TDefinition> = ContentServiceBase<TDefinition> &
  ContentVisibilityMembers<TDefinition, ContentVisibilityMethods<TDefinition>> &
  (TDefinition extends { duplication: { enabled: true } }
    ? ContentDuplicationMethods<TDefinition>
    : Partial<Record<keyof ContentDuplicationMethods<TDefinition>, never>>) &
  (TDefinition extends { publication: { enabled: true } }
    ? ContentPublicationMethods<TDefinition>
    : Partial<Record<keyof ContentPublicationMethods<TDefinition>, never>>);

export interface ContentServiceBase<TDefinition> {
  /** The advanced collections of one record. Two queries per collection field. */
  advanced: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentAdvancedValues<TDefinition>>;

  /** Only the named to-many relations and repeatables of one record. */
  advancedFields: (
    id: ContentIdOf<TDefinition>,
    fields: readonly string[],
    options?: ContentServiceOptions,
  ) => Promise<Record<string, unknown>>;
  /** Throws a `ZodError` if `values` does not satisfy `schemas.create`. */
  create: (
    values: ContentCreateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition>>;
  /** Deletes a record and returns the deleted row, or `null` when it did not exist. */
  delete: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition> | null>;
  /** The base-table row, or `null`. */
  findById: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentSelect<TDefinition> | null>;

  /** The base-table row plus its to-many relations and repeatables, or `null`. */
  findDetail: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentDetail<TDefinition> | null>;
  /** One page of rows with labels, filtered, ordered and searched as the admin list is. */
  findMany: (args?: ContentFindManyArgs<TDefinition>) => Promise<{
    edges: ContentListRow<TDefinition>[];
    pageInfo: ContentPageInfo;
  }>;

  findRowById: (
    id: ContentIdOf<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentListRow<TDefinition> | null>;

  /**
   * Picker options for a `relation` or `user` field: matching `search`, or the
   * given `ids` when resolving current values.
   */
  options: (
    field: ContentReferenceFieldName<TDefinition>,
    search?: string,
    ids?: readonly ContentId[],
  ) => Promise<{ color?: string; label: string; value: ContentId }[]>;

  /** Typed operations on each to-many relation, keyed by field name. */
  relations: {
    [K in ContentRelationCollectionName<TDefinition>]: ContentRelationMethods<
      TDefinition,
      ContentReferenceIdOf<ContentFieldsOf<TDefinition>[K]>
    >;
  };
  /**
   * Typed repeatable operations, keyed by the content type's actual repeatable
   * field names - each one carrying its own child shape.
   */
  repeatable: {
    [K in ContentRepeatableFieldName<TDefinition>]: ContentRepeatableMethods<
      TDefinition,
      K
    >;
  };
  /** Throws a `ZodError` if `values` does not satisfy `schemas.update`. */
  update: (
    id: ContentIdOf<TDefinition>,
    values: ContentUpdateInput<TDefinition>,
    options?: ContentServiceOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

export const createContentService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  advanced,
  c,
  columns,
  definition,
  schemas,
  table,
  translation,
}: {
  advanced?: ContentAdvancedStore;
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  schemas: ContentSchemas<TDefinition>;
  table: PgTableWithColumns<TableConfig>;
  translation?: {
    columns: Record<string, PgColumn>;
    model?: () => ContentTranslationModel<TDefinition>;
    table: PgTable;
  };
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
  const primaryCursor = columns.id as PaginationCursorColumn;
  const orderable = orderableColumns(definition);
  const publication = definition.publication.enabled;
  const generatedColumnNames = [
    ...CONTENT_SYSTEM_FIELDS,
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
    ...(definition.editorial.enabled ? CONTENT_EDITORIAL_FIELDS : []),
    ...(definition.visibility.enabled ? CONTENT_VISIBILITY_FIELDS : []),
  ];
  const ownColumnNames = [
    ...generatedColumnNames,
    ...Object.keys(storageColumns),
  ];
  const references = resolveReferenceTargets(definition, table, columns);
  // The to-many half of the same question. Kept in its own map because these
  // targets are never joined into the list query - a to-many field has no
  // column on this row to join through - and are only ever read by the picker.
  const collectionReferences = resolveCollectionPickerTargets(
    definition,
    field => store?.targetTable(field) ?? null,
  );
  // The references whose label is not on the target's base table at all. Empty
  // for every content type that points at a shared title, which is what keeps
  // the language registry out of their query plan entirely.
  //
  // **Both** maps, and the to-many half is not optional: a picker whose target
  // has a localized title has no label column to fall back on - the value is on
  // the translation table and nowhere else - so leaving collections out of this
  // is what makes such a field offer bare identifiers.
  const localizedReferences = [
    ...Object.entries(references),
    ...Object.entries(collectionReferences),
  ].filter(([, target]) => target.localizedLabel !== undefined);
  const isSharedField = (name: string): boolean =>
    sharedFields[name] !== undefined;
  const searchColumns = definition.admin.list.searchableFields
    .filter(isSharedField)
    .map(name => columns[name]);
  const translationSearchColumns = translation
    ? definition.admin.list.searchableFields
        .filter(name => !isSharedField(name))
        .map(name => translation.columns[name])
    : [];

  const searchCondition = (term: string | undefined): SQL | undefined => {
    const shared = buildSearchCondition(searchColumns, term);
    const localizedMatch = buildSearchCondition(translationSearchColumns, term);
    const localized =
      translation && localizedMatch
        ? sql`exists (select 1 from ${translation.table} where ${and(
            eq(translation.columns.itemId, primaryCursor),
            localizedMatch,
          )})`
        : undefined;

    return shared && localized ? or(shared, localized) : (shared ?? localized);
  };

  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    fields,
  );

  const mutableRelations: Record<
    string,
    ContentRelationMethods<TDefinition>
  > = {};
  const mutableRepeatables: Record<
    string,
    ContentRepeatableMethods<TDefinition, never>
  > = {};

  const db = (options?: ContentServiceOptions): ContentDatabase =>
    options?.tx ?? c.get("db");

  const ownSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(ownColumnNames.map(name => [name, columns[name]]));

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

  const galleryFieldNames = Object.keys(
    contentFileCollectionFields(definition),
  );

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

  const viewerLocale = (): string | undefined => {
    const i18n: undefined | { resolveLocale: () => string } = c.get("i18n");

    return i18n?.resolveLocale();
  };

  const labelLanguages = async (): Promise<{
    byDefaultLocale: Map<string, null | number>;
    viewer: null | number;
  }> => {
    const byDefaultLocale = new Map<string, null | number>();
    if (localizedReferences.length === 0) {
      return { byDefaultLocale, viewer: null };
    }

    const locale = viewerLocale();
    const viewer =
      locale === undefined ? null : await findContentLanguage(c, locale);

    for (const [, target] of localizedReferences) {
      const defaultLocale = target.localizedLabel?.defaultLocale;
      if (defaultLocale === undefined || byDefaultLocale.has(defaultLocale)) {
        continue;
      }

      const language = await findContentLanguage(c, defaultLocale);
      byDefaultLocale.set(defaultLocale, language?.id ?? null);
    }

    return { byDefaultLocale, viewer: viewer?.id ?? null };
  };

  /** A join the label of one reference field needs to be readable. */
  interface ReferenceJoin {
    on: SQL | undefined;
    table: PgTable;
  }

  /** How one reference field's label is selected, searched and ordered. */
  interface ReferenceLabel {
    joins: ReferenceJoin[];
    label: PgColumn | SQL<null | string>;
    /** The real columns behind {@link ReferenceLabel.label}, for `ilike`. */
    searchColumns: PgColumn[];
  }

  const labelSelection = (
    target: ContentPickerTarget,
    languages: {
      byDefaultLocale: Map<string, null | number>;
      viewer: null | number;
    },
  ): ReferenceLabel => {
    const plain: ReferenceLabel = {
      joins: [],
      label: target.labelColumn,
      searchColumns: [target.labelColumn],
    };
    const localized = target.localizedLabel;
    if (!localized) return plain;

    const fallbackId =
      languages.byDefaultLocale.get(localized.defaultLocale) ?? null;
    const wanted = [
      { languageId: languages.viewer, source: localized.viewer },
      // Skipped when the reader is already in the target's own language: one
      // join, and a `coalesce` over one column.
      ...(fallbackId !== null && fallbackId !== languages.viewer
        ? [{ languageId: fallbackId, source: localized.fallback }]
        : []),
    ].filter(
      (entry): entry is { languageId: number; source: typeof entry.source } =>
        entry.languageId !== null,
    );

    if (wanted.length === 0) return plain;

    return {
      joins: wanted.map(({ languageId, source }) => ({
        on: and(
          eq(source.itemColumn, target.idColumn),
          eq(source.languageColumn, languageId),
        ),
        table: source.aliased,
      })),
      label: sql<null | string>`coalesce(${sql.join(
        wanted.map(({ source }) => source.labelColumn),
        sql`, `,
      )})`,
      searchColumns: wanted.map(({ source }) => source.labelColumn),
    };
  };

  /** {@link labelSelection} for every reference field, in one registry read. */
  const referenceLabels = async (): Promise<Record<string, ReferenceLabel>> => {
    const languages = await labelLanguages();

    return Object.fromEntries(
      Object.entries(references).map(([name, target]) => [
        name,
        labelSelection(target, languages),
      ]),
    );
  };

  const readOne = async (
    id: ContentId,
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
    id: ContentId,
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

  const visibilityTransition = async (
    id: ContentId,
    action: ContentVisibilityAction,
    options: ContentVisibilityOptions | undefined,
  ): Promise<ContentVisibilityResult<TDefinition> | null> =>
    await inTransaction(options, async tx => {
      const [current] = await tx
        .select(ownSelection())
        .from(table)
        .where(eq(primaryCursor, id))
        .limit(1)
        .for("update");
      if (!current) return null;

      if (isInVisibilityState(action, current)) {
        return {
          changed: false,
          ...visibilityStateOf(current),
          row: toRow(current),
          visibility: visibilityChange({
            actorUserId: options?.actorUserId,
            after: current,
            before: current,
          }),
        };
      }

      const [row] = await tx
        .update(table)
        .set(visibilityValues(action, options?.actorUserId))
        .where(eq(primaryCursor, id))
        .returning(ownSelection());
      if (!row) return null;

      return {
        changed: true,
        ...visibilityStateOf(row),
        row: toRow(row),
        visibility: visibilityChange({
          actorUserId: options?.actorUserId,
          after: row,
          before: current,
        }),
      };
    });

  const hideableMethods: ContentVisibilityMethods<TDefinition> = {
    hide: async (id, options) =>
      await visibilityTransition(id, "hide", options),
    unhide: async (id, options) =>
      await visibilityTransition(id, "unhide", options),
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
   * Always a transaction, even for a content type with no collections.
   *
   * `transact` skips one when there is nothing to be atomic about; a collection
   * mutation is a read-modify-write and always has something, so it needs the
   * stronger guarantee unconditionally.
   */
  const inTransaction = async <TResult>(
    options: ContentServiceOptions | undefined,
    body: (tx: ContentDatabase) => Promise<TResult>,
  ): Promise<TResult> =>
    options?.tx
      ? await body(options.tx)
      : await c.get("db").transaction(async tx => await body(tx));

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
  const lockRow = async (
    tx: ContentDatabase,
    id: ContentId,
    { force = false }: { force?: boolean } = {},
  ): Promise<boolean> => {
    // A content type with no collections has no read-modify-write to protect, so
    // an ordinary `update` skips the extra statement. `force` is the collection
    // path, which always needs it.
    if (!force && !store?.enabled) return true;

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

    advancedFields: async (id, wanted, options) =>
      (await store?.load(id, db(options), wanted)) ?? {},

    create: async (values, options) =>
      await transact(options, async tx => {
        // Generated routes validate too, but a plugin can call the service
        // directly - and then this is the only thing standing between an
        // untrusted object and Drizzle. Only the parsed result is written.
        const parsed = schemas.create.parse(values) as Record<string, unknown>;

        // A successful upload is not a valid assignment: the file this id names
        // was checked against the field it was uploaded for, and this checks it
        // against the field it is being written to. No statement at all for a
        // content type with no file fields.
        await assertContentFileReferences(c, definition, parsed, tx);
        await resolveContentContainerAssignment(tx, definition, parsed);
        await assertContentThreadPlacement(
          tx,
          { columns, definition, table },
          {
            id: null,
            values: parsed,
          },
        );

        const [row] = await tx
          .insert(table)
          .values(toInsertColumns(fields, withCreateSlugs(parsed)))
          .returning(ownSelection());

        // In the same transaction as the row it belongs to: a create that
        // committed its categories and rolled back its article would leave
        // junction rows pointing at nothing.
        if (store?.enabled) {
          await store.write(
            tx,
            requireContentId(definition.idStrategy, row.id, contentTypeId),
            parsed,
          );
        }

        return toRow(row);
      }),

    delete: async (id, options) => {
      const [row] = await db(options)
        .delete(table)
        .where(eq(primaryCursor, id))
        .returning(ownSelection());
      if (row) await cancelContentSubmissions(db(options), definition, id);

      return row ? toRow(row) : null;
    },

    findById: async (id, options) => {
      const row = await readOne(id, db(options));

      return row ? toRow(row) : null;
    },

    findRowById: async (id, options) => {
      const labels = await referenceLabels();
      const selection: Record<string, PgColumn | SQL<null | string>> = {
        ...ownSelection(),
        ...Object.fromEntries(
          Object.entries(labels).map(([name, entry]) => [
            `${LABEL_PREFIX}${name}`,
            entry.label,
          ]),
        ),
      };

      let builder = db(options).select(selection).from(table).$dynamic();

      for (const [name, target] of Object.entries(references)) {
        builder = builder.leftJoin(
          target.aliased,
          eq(target.owner, target.idColumn),
        );
        for (const join of labels[name].joins) {
          builder = builder.leftJoin(join.table, join.on);
        }
      }

      const [row] = await builder.where(eq(primaryCursor, id)).limit(1);

      return row ? splitLabels(row) : null;
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
          visibility: definition.visibility.enabled,
        }),
        searchCondition(query.search),
      ].filter((item): item is SQL => item !== undefined);

      const combined =
        conditions.length > 1 ? and(...conditions) : conditions[0];

      // Resolved before the page query rather than inside it, so the language
      // registry is read once for the list instead of once per `query` call.
      const labels = await referenceLabels();

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
        query: async ({
          cursorSelection,
          limit,
          offset,
          orderBy: order,
          where: rowWhere,
        }) => {
          // One LEFT JOIN per reference field resolves every label in the same
          // round trip - there is no per-row lookup anywhere. The cursor value
          // rides along in the same statement, which is what makes the cursor a
          // record of where the row was rather than where it has since moved.
          const selection: Record<string, PgColumn | SQL<null | string>> = {
            ...ownSelection(),
            ...Object.fromEntries(
              Object.entries(labels).map(([name, entry]) => [
                `${LABEL_PREFIX}${name}`,
                entry.label,
              ]),
            ),
            // Last, so a content field can never shadow it and leave the page
            // with no way to mint a cursor.
            ...cursorSelection,
          };

          let builder = c.get("db").select(selection).from(table).$dynamic();

          for (const [name, target] of Object.entries(references)) {
            builder = builder.leftJoin(
              target.aliased,
              eq(target.owner, target.idColumn),
            );
            // A localized title hangs off the target's translation table, on
            // `(itemId, languageId)` - its primary key, so the page keeps
            // exactly the rows the base query selected.
            for (const join of labels[name].joins) {
              builder = builder.leftJoin(join.table, join.on);
            }
          }

          return await builder
            .where(rowWhere)
            .orderBy(order)
            .limit(
              typeof limit === "number" ? limit : CONTENT_DEFAULT_PAGE_SIZE,
            )
            .offset(offset);
        },
      });

      return {
        edges: data.edges.map(splitLabels),
        pageInfo: data.pageInfo,
      };
    },

    options: async (fieldName, search, ids) => {
      // A to-many field's target is resolved through its junction rather than
      // through a column on this row - see `collectionReferences`.
      const target = references[fieldName] ?? collectionReferences[fieldName];
      if (!target) {
        throw new ContentEngineError(
          `Field "${fieldName}" is not a relation or user field.`,
          { contentTypeId },
        );
      }

      // An empty `ids` is a question with an empty answer, not "no filter":
      // a form holding no references must not be handed the first 50 rows as
      // though it had chosen them.
      if (ids?.length === 0) return [];

      // A `user` field selects two columns more, so its picker can show a face
      // and a handle. Kept out of the projection for a `relation`, whose target
      // is a content type with neither.
      const user = target.userColumns;
      // Searched and ordered by whatever the label is actually read from, so a
      // localized target's picker matches what the reader sees rather than a
      // base-table column that does not hold the name at all.
      const {
        joins,
        label,
        searchColumns: searchable,
      } = labelSelection(target, await labelLanguages());

      let builder = c
        .get("db")
        .select({
          label,
          value: target.idColumn,
          ...(user
            ? { avatarColor: user.avatarColor, nameCode: user.nameCode }
            : {}),
          // A target that declares `admin.colorField` sends its swatch along, so
          // a colour-coded record reads as one in the picker too.
          ...(target.colorColumn ? { color: target.colorColumn } : {}),
        })
        .from(target.aliased)
        .$dynamic();

      for (const join of joins) {
        builder = builder.leftJoin(join.table, join.on);
      }

      const rows = await builder
        // A person is searched by handle as well as by name: `@ada` is how half
        // the AdminCP refers to somebody, and a picker that only matched display
        // names would find nothing for it.
        .where(
          ids
            ? inArray(target.idColumn, [...ids])
            : buildSearchCondition(
                user ? [...searchable, user.nameCode] : searchable,
                search,
              ),
        )
        .orderBy(label)
        // A label lookup is bounded by what the caller already holds, and a
        // record may hold more references than a picker would ever list.
        .limit(ids ? ids.length : CONTENT_OPTIONS_LIMIT);

      return rows.map(row => {
        const value: ContentId =
          typeof row.value === "number" ? row.value : String(row.value);
        const entry = row as Record<string, unknown>;

        const color = target.colorColumn ? toLabel(entry.color) : null;

        return {
          label: toLabel(row.label) ?? String(value),
          value,
          ...(user
            ? {
                avatarColor: toLabel(entry.avatarColor) ?? "",
                nameCode: toLabel(entry.nameCode) ?? "",
              }
            : {}),
          // Omitted rather than sent empty when the row's colour is null: an
          // option with no colour and one whose colour is blank are the same
          // thing to a swatch, and only one of them needs a key.
          ...(color === null || color === "" ? {} : { color }),
        };
      });
    },

    relations:
      mutableRelations as unknown as ContentServiceBase<TDefinition>["relations"],

    repeatable: mutableRepeatables as ContentService<TDefinition>["repeatable"],

    update: async (id, values, options) =>
      await transact(options, async tx => {
        // Parsed before the row is even read, so an invalid payload never costs
        // a query - and never reaches Drizzle. Normalised before the diff, so
        // re-sending the stored slug in a different case counts as no change
        // rather than as a pointless write.
        const patch = withUpdateSlugs(schemas.update.parse(values));

        if (!(await lockRow(tx, id))) return null;

        return await applyPatch(tx, id, patch);
      }),
  };

  /**
   * Applies an already-parsed patch to a **locked** row.
   *
   * Split out of `update` so the collection helpers can lock, read the current
   * collection and apply the result they compute from it without leaving the
   * transaction - the read and the write have to be one atomic step, or two
   * concurrent `add` calls each write a list that never saw the other's.
   */
  const applyPatch = async (
    tx: ContentDatabase,
    id: ContentId,
    patch: Record<string, unknown>,
  ): Promise<ContentUpdateResult<TDefinition> | null> => {
    {
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

      await assertContentFileReferences(c, definition, patch, tx, {
        existing: async () => ({
          ...projectRow(current),
          ...(await store?.load(id, tx, galleryFieldNames)),
        }),
      });

      if (changedPaths.length > 0) {
        assertNoContentSelfReference(definition, id, patch);
        await assertContentThreadPlacement(
          tx,
          { columns, definition, table },
          {
            id,
            values: patch,
          },
        );
        await resolveContentContainerAssignment(tx, definition, patch);
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
    }
  };

  /**
   * Locks the source record, reads one collection and applies what `compute`
   * makes of it - all in one transaction.
   *
   * The order is the fix: `SELECT ... FOR UPDATE` first, *then* the read. Two
   * concurrent `add` calls therefore serialise on the row rather than both
   * reading the same empty list and each writing a single-element one - which is
   * how one of the two additions used to disappear with nothing to show it had.
   *
   * The lock is the database's, not the process's: a second API instance is
   * serialised by exactly the same primitive.
   */
  const runCollection = async (
    itemId: ContentId,
    field: string,
    compute: (current: unknown[]) => unknown[],
    options: ContentServiceOptions | undefined,
  ): Promise<ContentUpdateResult<TDefinition> | null> =>
    await inTransaction(options, async tx => {
      if (!(await lockRow(tx, itemId, { force: true }))) return null;

      const current = await store?.load(itemId, tx, [field]);
      const value = current?.[field];
      const next = compute(Array.isArray(value) ? value : []);

      return await applyPatch(
        tx,
        itemId,
        schemas.update.parse({ [field]: next }),
      );
    });

  const collectionApi = {
    read: async (itemId: ContentId, field: string, options: unknown) => {
      const loaded = await store?.load(
        itemId,
        db(options as ContentServiceOptions | undefined),
        [field],
      );
      const value = loaded?.[field];

      return Array.isArray(value) ? value : [];
    },
    run: runCollection,
    write: async (
      itemId: ContentId,
      field: string,
      next: readonly unknown[],
      options: ContentServiceOptions | undefined,
    ) =>
      // `set` replaces the whole collection, so it never reads and cannot lose a
      // concurrent write. It still goes through `update`, which locks.
      await service.update(
        itemId as ContentIdOf<TDefinition>,
        { [field]: [...next] } as ContentUpdateInput<TDefinition>,
        options,
      ),
  };

  // The operations themselves live in `collection-api.ts`: they are the same
  // arithmetic on both services, and the only thing that differs is the locking
  // the runner above supplies.
  const { relations, repeatables } = contentCollectionKinds(
    definition,
    store?.fields ?? [],
  );

  for (const field of relations) {
    const fieldValue = definition.fields[field];
    mutableRelations[field] = buildContentRelationOperations({
      api: collectionApi,
      contentTypeId,
      field,
      strategy:
        fieldValue.kind === "relation"
          ? contentRelationStrategy(definition, fieldValue)
          : "serial",
    });
  }
  for (const field of repeatables) {
    mutableRepeatables[field] = buildContentRepeatableOperations({
      api: collectionApi,
      contentTypeId,
      field,
    }) as unknown as ContentRepeatableMethods<TDefinition, never>;
  }

  const duplicationMethods: ContentDuplicationMethods<TDefinition> = {
    duplicate: async (sourceId, options = {}) => {
      const translationModel = translation?.model;
      const result = await runContentDuplicate(
        {
          advanced: store,
          c,
          columns,
          definition,
          table,
          translation:
            translation && translationModel
              ? {
                  columns: translation.columns,
                  model:
                    translationModel as unknown as () => ContentDuplicateTranslationSource,
                  table: translation.table,
                }
              : undefined,
        },
        sourceId,
        options,
        {
          base: async (values, tx) =>
            await service.create(values as ContentCreateInput<TDefinition>, {
              tx,
            }),
          idOf: row =>
            requireContentId(
              definition.idStrategy,
              (row as { id: unknown }).id,
              contentTypeId,
            ),
          translation: async (itemId, locale, values, tx) => {
            if (!translationModel) {
              throw new ContentEngineError(
                "Duplicating a translation needs the translation model.",
                { contentTypeId },
              );
            }

            return await translationModel().create(
              itemId as ContentIdOf<TDefinition>,
              locale,
              values as ContentLocalizedValues<TDefinition>,
              { tx },
            );
          },
        },
      );

      return result
        ? {
            row: result.base,
            skippedLocales: result.skippedLocales,
            sourceId,
            translations: result.translations,
          }
        : null;
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
    ...(definition.duplication.enabled ? duplicationMethods : {}),
    ...(definition.visibility.enabled ? hideableMethods : {}),
  } as ContentService<TDefinition>;
};
