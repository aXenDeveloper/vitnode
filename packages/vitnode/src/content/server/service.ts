import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import type { PaginationCursorColumn } from "../../api/lib/with-pagination";
import type { ContentSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentAdvancedValues,
  ContentChangedPath,
  ContentCreateInput,
  ContentDetail,
  ContentFilterInput,
  ContentInnerFieldsOf,
  ContentOrderableFieldName,
  ContentReferenceFieldName,
  ContentRelationCollectionName,
  ContentRepeatableFieldName,
  ContentRepeatableInputRow,
  ContentRepeatableRow,
  ContentSelect,
  ContentUpdateInput,
  ContentValuesOf,
} from "../types";
import type { ContentAdvancedStore } from "./advanced-store";
import type { ContentPickerTarget } from "./references";

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
  buildContentRelationOperations,
  buildContentRepeatableOperations,
  contentCollectionKinds,
} from "./collection-api";
import { assertContentFileReferences } from "./files";
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
  LABEL_PREFIX,
  resolveCollectionPickerTargets,
  resolveReferenceTargets,
  toLabel,
} from "./references";
import { createSlugNormalizer } from "./slugs";

/** Display labels for `user` and `relation` values, keyed by field name. */
export type ContentLabels = Record<string, null | string>;

export type ContentListRow<TDefinition> = ContentSelect<TDefinition> & {
  labels: ContentLabels;
};

export interface ContentPageInfo {
  count: number;
  /**
   * An opaque cursor for the last row on this page.
   *
   * It encodes the ordered tuple - the sort column's value *and* the row's
   * identifier - so it is meaningless outside the ordering that produced it.
   * Hand it back as `cursor`; never parse it.
   */
  endCursor: null | string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: null | string;
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
 * The typed collection API of one content type, on the **plain** service.
 *
 * Every mutating method is a read-modify-write that runs inside one transaction
 * with the source row locked first, so two concurrent `add` calls merge instead
 * of one overwriting the other. It goes through the same `update` an ordinary
 * field edit does, which is what gives it the no-op rule and the `updatedAt`
 * bump for free.
 *
 * What it does **not** do is write a revision or emit an event - the plain
 * service never has, for a field edit either. Those belong to
 * `model.editorialService(c)?.relations` and
 * `model.editorialService(c)?.repeatable`, which additionally require an
 * `expectedVersion` and answer a stale one with a structured conflict.
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

export interface ContentRepeatableMethods<TDefinition, TName> {
  /**
   * Appends one child.
   *
   * Typed from the repeatable's own leaves, so `{ question, answer }` compiles
   * and `{ unknownField }` does not - the definition already carries the child
   * shape, and a `Record<string, unknown>` here would throw it away.
   */
  create: (
    itemId: number,
    values: ContentValuesOf<ContentInnerFieldsOf<TDefinition, TName>>,
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
  ) => Promise<
    ContentRepeatableRow<ContentInnerFieldsOf<TDefinition, TName>>[]
  >;
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
    rows: readonly ContentRepeatableInputRow<
      ContentInnerFieldsOf<TDefinition, TName>
    >[],
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
  /**
   * Updates one child by its stable identifier.
   *
   * Partial, and over the repeatable's own leaves: naming a leaf the repeatable
   * does not declare is a compile error rather than a value silently dropped by
   * the strict schema at runtime.
   */
  update: (
    itemId: number,
    childId: number,
    values: Partial<ContentValuesOf<ContentInnerFieldsOf<TDefinition, TName>>>,
    options?: ContentWriteOptions,
  ) => Promise<ContentUpdateResult<TDefinition> | null>;
}

/**
 * Options for a collection mutation on the **plain** service.
 *
 * Deliberately identical to `ContentServiceOptions`: there is no
 * `expectedVersion` here, because this service has no version column to guard on
 * and would have had to ignore one. Concurrent writers are serialised by the
 * source row's `SELECT ... FOR UPDATE` instead, so two `add` calls merge rather
 * than one of them being rejected.
 *
 * Optimistic locking, revisions and events are the editorial service's -
 * `model.editorialService(c)?.relations`, which takes a required
 * `expectedVersion` and an `actor`. The two are separate objects rather than one
 * that behaves differently depending on where it came from.
 */
export type ContentWriteOptions = ContentServiceOptions;

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
  /**
   * A named subset of the advanced collections, for a caller with an allowlist.
   *
   * The search synchronizer and the public projection each need only the
   * collections their configuration actually mentions, and querying a private
   * junction table to discard the rows afterwards is work with no answer
   * attached. Untyped in its keys on purpose: the allowlist is derived from
   * configuration at runtime, and `advanced` is the typed whole-record read.
   */
  advancedFields: (
    id: number,
    fields: readonly string[],
    options?: ContentServiceOptions,
  ) => Promise<Record<string, unknown>>;
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
  /**
   * One record **with its reference labels**, exactly as the list returns them.
   *
   * The read a form makes: a `relation` or `user` value is an identifier, and an
   * editor has to be shown the name behind it. `findById` deliberately stays a
   * plain row - the labels cost one LEFT JOIN per reference field, and the
   * callers that only want the record should not pay for them.
   *
   * Administrative, like every label: it is read from the target's
   * `admin.titleField`, which may name something the target never publishes. The
   * public projection does not use it.
   */
  findRowById: (
    id: number,
    options?: ContentServiceOptions,
  ) => Promise<ContentListRow<TDefinition> | null>;
  /**
   * Options for a `user` or `relation` picker, to-one and to-many alike.
   *
   * `search` filters by whatever the label is actually read from. `ids` asks for
   * exactly those rows instead, which is how a form that opens holding
   * identifiers turns them into names: without it a to-many picker could only
   * label what somebody had just searched for, and everything already stored
   * would read as a number.
   */
  options: (
    field: ContentReferenceFieldName<TDefinition>,
    search?: string,
    ids?: readonly number[],
  ) => Promise<{ color?: string; label: string; value: number }[]>;
  /**
   * Typed to-many relation operations, keyed by the content type's **actual**
   * relation collection names.
   *
   * A mapped type rather than a `Record<string, …>`: with the latter,
   * `service.relations.thisFieldDoesNotExist` compiled and failed at runtime.
   * Empty for a content type that declares none, so `service.relations` always
   * exists and every key on it is one the definition has.
   */
  relations: Record<
    ContentRelationCollectionName<TDefinition>,
    ContentRelationMethods<TDefinition>
  >;
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
  const primaryCursor = columns.id as PaginationCursorColumn;
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
  const searchColumns = definition.admin.list.searchableFields.map(
    name => columns[name],
  );
  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    fields,
  );

  /**
   * The keyed collection maps, assembled after the service object exists.
   *
   * Built as loose records and re-typed once at the boundary: the public type is
   * keyed by the content type's actual collection names, which is what makes
   * `service.relations.typo` a compile error - but a loop cannot prove to
   * TypeScript that it filled exactly those keys.
   */
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

  /**
   * A database row, in the logical shape callers see.
   *
   * The generated columns pass straight through; the declared fields go through
   * `contentColumnsToValues`, which folds `seoTitle` and `seoDescription` back
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

  /**
   * The locale the AdminCP is being *read* in, or nothing.
   *
   * `undefined` outside a request that carries the i18n model - a queue handler,
   * a test harness - and the fallback then does the whole job, which is the
   * honest answer when nobody has said what language they are in.
   */
  const viewerLocale = (): string | undefined => {
    const i18n: undefined | { resolveLocale: () => string } = c.get("i18n");

    return i18n?.resolveLocale();
  };

  /**
   * `core_languages.id` for the reader's locale, and for each localized
   * target's own default.
   *
   * One registry read for the whole request - `findContentLanguage` memoises it
   * per context - and none at all for a content type with no localized relation
   * target, which is every content type that existed before this.
   */
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

  /**
   * What a reference field's label is selected as, and the joins that make it
   * so.
   *
   * A shared title is the column it always was. A **localized** one is
   * `coalesce(reader's language, target's default language)` over two joins onto
   * the target's translation table - each on `(itemId, languageId)`, which is
   * that table's primary key, so neither can multiply the rows of the query it
   * is added to. With neither language present in `core_languages` the id comes
   * back, exactly as it did before.
   */
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
    id: number,
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
        }),
        buildSearchCondition(searchColumns, query.search),
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
            );
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
        const value = Number(row.value);
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

    relations: mutableRelations,

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
    id: number,
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

      await assertContentFileReferences(c, definition, patch, tx);

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
    itemId: number,
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
    read: async (itemId: number, field: string, options: unknown) => {
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
      itemId: number,
      field: string,
      next: readonly unknown[],
      options: ContentServiceOptions | undefined,
    ) =>
      // `set` replaces the whole collection, so it never reads and cannot lose a
      // concurrent write. It still goes through `update`, which locks.
      await service.update(
        itemId,
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
    mutableRelations[field] = buildContentRelationOperations({
      api: collectionApi,
      contentTypeId,
      field,
    });
  }
  for (const field of repeatables) {
    mutableRepeatables[field] = buildContentRepeatableOperations({
      api: collectionApi,
      contentTypeId,
      field,
    }) as ContentRepeatableMethods<TDefinition, never>;
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
