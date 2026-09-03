import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import type { ContentTranslationSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentLocalizedFieldName,
  ContentLocalizedUpdateValues,
  ContentLocalizedValues,
  ContentTranslationMeta,
  ContentTranslationRow,
} from "../types";
import type { ContentLanguage } from "./language-resolver";
import type { ContentDatabase } from "./service";

import {
  CONTENT_TRANSLATION_PUBLICATION_FIELDS,
  CONTENT_TRANSLATION_SYSTEM_FIELDS,
} from "../const";
import {
  ContentDefaultTranslationRequired,
  ContentEngineError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentStorageColumns,
  contentValuesToColumns,
} from "../paths";
import {
  contentDatabase,
  findContentLanguage,
  listContentLanguages,
  resolveContentLanguage,
} from "./language-resolver";
import { diffChangedFields } from "./query";
import { createSlugNormalizer } from "./slugs";

export interface ContentTranslationOptions {
  /** Run inside an existing transaction. */
  tx?: ContentDatabase;
}

export const CONTENT_TRANSLATION_INITIAL_VERSION: unique symbol = Symbol(
  "vitnode.content.translation.initialVersion",
);

export interface ContentTranslationCreateOptions extends ContentTranslationOptions {
  /** @internal Set only by the translation editorial service. */
  [CONTENT_TRANSLATION_INITIAL_VERSION]?: number;
}

export interface ContentTranslationWriteOptions extends ContentTranslationOptions {
  expectedVersion: number;
}

export interface ContentTranslationUpdateResult<TDefinition> {
  /** `false` when nothing moved: no write, no version bump, no `updatedAt`. */
  changed: boolean;
  changedFields: ContentLocalizedFieldName<TDefinition>[];
  row: ContentTranslationRow<TDefinition>;
  version: number;
}

export interface ContentTranslationTransitionOptions extends ContentTranslationOptions {
  expectedVersion?: number;
}

export interface ContentTranslationTransitionResult<TDefinition> {
  /** `false` when the translation was already in the requested state. */
  changed: boolean;
  row: ContentTranslationRow<TDefinition>;
  version: number;
}

export interface ContentTranslationModel<TDefinition> {
  create: (
    itemId: number,
    locale: string,
    values: ContentLocalizedValues<TDefinition>,
    options?: ContentTranslationCreateOptions,
  ) => Promise<ContentTranslationRow<TDefinition>>;

  delete: (
    itemId: number,
    locale: string,
    options: ContentTranslationWriteOptions,
  ) => Promise<ContentTranslationRow<TDefinition> | null>;
  exists: (
    itemId: number,
    locale: string,
    options?: ContentTranslationOptions,
  ) => Promise<boolean>;

  findBasePublication: (
    itemId: number,
    options?: ContentTranslationOptions,
  ) => Promise<null | { publishedAt: Date | null; status: string | undefined }>;
  findByLanguageId: (
    itemId: number,
    languageId: number,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationRow<TDefinition> | null>;
  findByLocale: (
    itemId: number,
    locale: string,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationRow<TDefinition> | null>;

  findManyByLanguageId: (
    itemIds: readonly number[],
    languageId: number,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationRow<TDefinition>[]>;
  /** Metadata for every translation of one record, without the values. */
  findManyForItem: (
    itemId: number,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationMeta<TDefinition>[]>;

  findManyRowsForItem: (
    itemId: number,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationRow<TDefinition>[]>;

  publish: (
    itemId: number,
    locale: string,
    options?: ContentTranslationTransitionOptions,
  ) => Promise<ContentTranslationTransitionResult<TDefinition> | null>;
  /** The language this content type creates records in. */
  resolveDefaultLanguage: (
    options?: ContentTranslationOptions,
  ) => Promise<ContentLanguage>;

  resolveLanguage: (
    locale: string,
    options?: { requireEnabled?: boolean; tx?: ContentDatabase },
  ) => Promise<ContentLanguage>;

  unpublish: (
    itemId: number,
    locale: string,
    options?: ContentTranslationTransitionOptions,
  ) => Promise<ContentTranslationTransitionResult<TDefinition> | null>;
  /** Conditional `UPDATE` guarded by `expectedVersion`. A no-op writes nothing. */
  update: (
    itemId: number,
    locale: string,
    values: ContentLocalizedUpdateValues<TDefinition>,
    options: ContentTranslationWriteOptions,
  ) => Promise<ContentTranslationUpdateResult<TDefinition> | null>;
}

const translationSystemFields: readonly string[] =
  CONTENT_TRANSLATION_SYSTEM_FIELDS;

const toNullableDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createContentTranslationModel = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  columns,
  definition,
  schemas,
  table,
  translationTable,
}: {
  c: Context;
  /** Columns of the *translation* table, keyed by name. */
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  schemas: ContentTranslationSchemas<TDefinition>;
  /** The base table, for the "is there a record to translate" check. */
  table: PgTable;
  translationTable: PgTable;
}): ContentTranslationModel<TDefinition> => {
  const contentTypeId = definition.id;

  if (!definition.localization.enabled) {
    throw new ContentEngineError(
      "The translation service needs `localization: { enabled: true, defaultLocale }` on the content type.",
      { contentTypeId },
    );
  }

  const { localizedFields } = partitionContentFields(definition.fields);
  // Flattened, so a localized group is selected, written and diffed as its leaf
  // columns - and folded back into its nested shape by `toRow`.
  const localizedColumns = contentStorageColumns(localizedFields);
  const localizedNames = Object.keys(
    localizedColumns,
  ) as ContentLocalizedFieldName<TDefinition>[];
  const { defaultLocale } = definition.localization;

  // Generated column -> canonical path, so a translation reports `seo.title`
  // where it stores `seoTitle`.
  const pathByColumn = new Map(
    definition.advanced.leaves
      .filter(leaf => leaf.localized)
      .map(leaf => [leaf.columnName, leaf.path]),
  );

  const itemColumn = columns.itemId;
  const languageColumn = columns.languageId;
  const versionColumn = columns.version;
  const baseId = (table as unknown as Record<string, PgColumn>).id;

  const publication = definition.publication.enabled;
  const metaNames = [
    ...translationSystemFields,
    ...(publication ? CONTENT_TRANSLATION_PUBLICATION_FIELDS : []),
  ];

  // The same normaliser the base service uses, over the localized half of the
  // field map. Two slug algorithms is exactly the pair that drifts, and the
  // consequence would be `/en/my-post` and `/pl/my_post`.
  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    localizedColumns,
  );

  const metaSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(metaNames.map(name => [name, columns[name]]));

  const fullSelection = (): Record<string, PgColumn> => ({
    ...metaSelection(),
    ...Object.fromEntries(localizedNames.map(name => [name, columns[name]])),
  });

  const db = (options?: ContentTranslationOptions): ContentDatabase =>
    contentDatabase(c, options?.tx);

  const language = async (
    locale: string,
    { requireEnabled, tx }: { requireEnabled: boolean; tx?: ContentDatabase },
  ): Promise<ContentLanguage> =>
    await resolveContentLanguage(c, {
      contentTypeId,
      locale,
      requireEnabled,
      tx,
    });

  const publicationOf = (row: Record<string, unknown>): object =>
    publication
      ? {
          publishedAt: toNullableDate(row.publishedAt),
          status: row.status,
        }
      : {};

  const toMeta = (
    row: Record<string, unknown>,
    locale: string,
  ): ContentTranslationMeta<TDefinition> =>
    ({
      ...publicationOf(row),
      createdAt: row.createdAt as Date,
      itemId: row.itemId as number,
      languageId: row.languageId as number,
      locale,
      updatedAt: row.updatedAt as Date,
      version: row.version as number,
    }) as ContentTranslationMeta<TDefinition>;

  const toRow = (
    row: Record<string, unknown>,
    locale: string,
  ): ContentTranslationRow<TDefinition> => {
    // Nested, as the caller declared it: `seoTitle` and `seoDescription` become
    // `seo: { title, description }`, or `seo: null` when the group is nullable
    // and both leaves are empty.
    const values = contentColumnsToValues(localizedFields, row);

    return {
      ...toMeta(row, locale),
      values: values as ContentLocalizedValues<TDefinition>,
    } as ContentTranslationRow<TDefinition>;
  };

  const versionOf = (row: Record<string, unknown>): number =>
    typeof row.version === "number" ? row.version : 1;

  const readOne = async (
    itemId: number,
    languageId: number,
    database: ContentDatabase,
  ): Promise<null | Record<string, unknown>> => {
    const [row] = await database
      .select(fullSelection())
      .from(translationTable)
      .where(and(eq(itemColumn, itemId), eq(languageColumn, languageId)))
      .limit(1);

    return row ?? null;
  };

  const statusColumn = (): PgColumn => {
    if (!publication) {
      throw new ContentEngineError(
        "Translations can only be published on a content type with `publication: { enabled: true }` - without it there is no status column for a translation status to be subordinate to.",
        { contentTypeId },
      );
    }

    return columns.status;
  };

  const transition = async (
    itemId: number,
    locale: string,
    options: ContentTranslationTransitionOptions,
    {
      guard,
      requireEnabled,
      values,
    }: { guard: SQL; requireEnabled: boolean; values: Record<string, unknown> },
  ): Promise<ContentTranslationTransitionResult<TDefinition> | null> => {
    const target = await language(locale, {
      // Publishing into a locale the install has switched off would put content
      // on a page nothing renders, so `publish` asks for an enabled one exactly
      // as `create` and `update` do. Taking content *down* must stay possible
      // after a language is switched off, so `unpublish` does not.
      requireEnabled,
      tx: options.tx,
    });
    const database = db(options);

    const conditions = [
      eq(itemColumn, itemId),
      eq(languageColumn, target.id),
      guard,
    ];
    if (options.expectedVersion !== undefined) {
      conditions.push(eq(versionColumn, options.expectedVersion));
    }

    const [row] = await database
      .update(translationTable)
      .set({ ...values, version: sql`${versionColumn} + 1` })
      .where(and(...conditions))
      .returning(fullSelection());

    if (row) {
      return {
        changed: true,
        row: toRow(row, target.locale),
        version: versionOf(row),
      };
    }

    const current = await readOne(itemId, target.id, database);
    if (!current) return null;

    // Nothing matched but the row is there: either it was already in the
    // requested state, or the version moved. Only the second is an error.
    if (
      options.expectedVersion !== undefined &&
      versionOf(current) !== options.expectedVersion
    ) {
      throw new ContentTranslationVersionConflict({
        contentTypeId,
        currentVersion: versionOf(current),
        expectedVersion: options.expectedVersion,
        itemId,
        locale: target.locale,
      });
    }

    return {
      changed: false,
      row: toRow(current, target.locale),
      version: versionOf(current),
    };
  };

  const assertItemExists = async (
    itemId: number,
    database: ContentDatabase,
  ): Promise<void> => {
    const [row] = await database
      .select({ id: baseId })
      .from(table)
      .where(eq(baseId, itemId))
      .limit(1);

    if (!row) {
      throw new ContentTranslationItemMissing({ contentTypeId, itemId });
    }
  };

  return {
    create: async (itemId, locale, values, options) => {
      const target = await language(locale, {
        requireEnabled: true,
        tx: options?.tx,
      });
      const database = db(options);

      // Checked here rather than left to the foreign key: `23503` cannot say
      // which of the two references failed, and "no such article" and "no such
      // language" deserve different answers.
      await assertItemExists(itemId, database);

      const parsed = schemas.create.parse(values) as Record<string, unknown>;

      // Left to the column default unless the editorial layer named one. A
      // nonsensical value is rejected rather than written: the version is what
      // the whole optimistic-locking story is built on, and a zero or a fraction
      // would break every comparison downstream of it.
      const initialVersion = options?.[CONTENT_TRANSLATION_INITIAL_VERSION];
      if (
        initialVersion !== undefined &&
        (!Number.isInteger(initialVersion) || initialVersion < 1)
      ) {
        throw new ContentEngineError(
          `A translation of ${itemId} cannot start at version ${String(initialVersion)} - versions are integers from 1 upwards.`,
          { contentTypeId },
        );
      }

      const [row] = await database
        .insert(translationTable)
        .values({
          ...withCreateSlugs(contentValuesToColumns(localizedFields, parsed)),
          itemId,
          languageId: target.id,
          ...(initialVersion === undefined ? {} : { version: initialVersion }),
        })
        // Targeted at the primary key only, so "this locale already has a
        // translation" comes back as a row this can look up and name, while a
        // *slug* clash still raises `23505` and is reported as one. An untargeted
        // `onConflictDoNothing()` would swallow both and report the wrong thing.
        .onConflictDoNothing({
          target: [itemColumn, languageColumn],
        })
        .returning(fullSelection());

      if (row) return toRow(row, target.locale);

      throw new ContentTranslationExists({
        contentTypeId,
        itemId,
        locale: target.locale,
      });
    },

    delete: async (itemId, locale, options) => {
      // Resolved without `requireEnabled`: removing content in a language the
      // install has switched off is exactly what somebody would want to do next.
      const target = await language(locale, {
        requireEnabled: false,
        tx: options.tx,
      });

      if (target.locale.toLowerCase() === defaultLocale.toLowerCase()) {
        throw new ContentDefaultTranslationRequired({
          contentTypeId,
          itemId,
          locale: target.locale,
        });
      }

      const database = db(options);

      // The version is part of the statement that removes the row, not something
      // checked before it - otherwise two deletes could both pass the check.
      const [row] = await database
        .delete(translationTable)
        .where(
          and(
            eq(itemColumn, itemId),
            eq(languageColumn, target.id),
            eq(versionColumn, options.expectedVersion),
          ),
        )
        .returning(fullSelection());

      if (row) return toRow(row, target.locale);

      const current = await readOne(itemId, target.id, database);
      // Gone already is not a conflict: the caller wanted it removed, and it is.
      if (!current) return null;

      throw new ContentTranslationVersionConflict({
        contentTypeId,
        currentVersion: versionOf(current),
        expectedVersion: options.expectedVersion,
        itemId,
        locale: target.locale,
      });
    },

    exists: async (itemId, locale, options) => {
      const target = await findContentLanguage(c, locale, options?.tx);
      if (!target) return false;

      const [row] = await db(options)
        .select({ itemId: itemColumn })
        .from(translationTable)
        .where(and(eq(itemColumn, itemId), eq(languageColumn, target.id)))
        .limit(1);

      return row !== undefined;
    },

    findBasePublication: async (itemId, options) => {
      const baseColumns = table as unknown as Record<string, PgColumn>;
      const [row] = await db(options)
        .select(
          publication
            ? {
                publishedAt: baseColumns.publishedAt,
                status: baseColumns.status,
              }
            : { publishedAt: baseId, status: baseId },
        )
        .from(table)
        .where(eq(baseId, itemId))
        .limit(1);

      if (!row) return null;
      if (!publication) return { publishedAt: null, status: undefined };

      return {
        publishedAt: toNullableDate(row.publishedAt),
        status: typeof row.status === "string" ? row.status : undefined,
      };
    },

    findByLanguageId: async (itemId, languageId, options) => {
      const row = await readOne(itemId, languageId, db(options));
      if (!row) return null;

      // The canonical locale comes off the language registry rather than out of
      // the row, which only holds the id.
      const languages = await listContentLanguagesById(c, options?.tx);

      return toRow(row, languages.get(languageId)?.locale ?? "");
    },

    findByLocale: async (itemId, locale, options) => {
      const target = await findContentLanguage(c, locale, options?.tx);
      if (!target) return null;

      const row = await readOne(itemId, target.id, db(options));

      return row ? toRow(row, target.locale) : null;
    },

    findManyByLanguageId: async (itemIds, languageId, options) => {
      // No ids, no statement: an empty page must not become `IN ()`, which
      // Postgres reads as a syntax error rather than as "nothing".
      if (itemIds.length === 0) return [];

      const rows = await db(options)
        .select(fullSelection())
        .from(translationTable)
        .where(
          and(
            inArray(itemColumn, [...itemIds]),
            eq(languageColumn, languageId),
          ),
        );

      // The canonical locale comes off the language registry rather than out of
      // the rows, which only hold the id - and every row here is in the one
      // language that was asked for.
      const languages = await listContentLanguagesById(c, options?.tx);
      const locale = languages.get(languageId)?.locale ?? "";

      return rows.map(row => toRow(row, locale));
    },

    findManyForItem: async (itemId, options) => {
      // Metadata only, and no join: the locale is resolved from the
      // already-loaded language registry, so listing translations costs one
      // query for the rows plus (at most) one for every language in the install -
      // never one per translation.
      const rows = await db(options)
        .select(metaSelection())
        .from(translationTable)
        .where(eq(itemColumn, itemId))
        .orderBy(asc(languageColumn));

      const languages = await listContentLanguagesById(c, options?.tx);

      return rows.map(row =>
        toMeta(row, languages.get(row.languageId as number)?.locale ?? ""),
      );
    },

    findManyRowsForItem: async (itemId, options) => {
      const rows = await db(options)
        .select(fullSelection())
        .from(translationTable)
        .where(eq(itemColumn, itemId))
        .orderBy(asc(languageColumn));

      const languages = await listContentLanguagesById(c, options?.tx);

      return rows.map(row =>
        toRow(row, languages.get(row.languageId as number)?.locale ?? ""),
      );
    },

    publish: async (itemId, locale, options) =>
      await transition(itemId, locale, options ?? {}, {
        // COALESCE, so a republish keeps the date this language first went out.
        // The base row's publish does the same thing to the same effect.
        guard: ne(statusColumn(), "published"),
        requireEnabled: true,
        values: {
          publishedAt: sql`coalesce(${columns.publishedAt}, now())`,
          status: "published",
        },
      }),

    resolveDefaultLanguage: async options =>
      await language(defaultLocale, {
        requireEnabled: true,
        tx: options?.tx,
      }),

    resolveLanguage: async (locale, options) =>
      await language(locale, {
        requireEnabled: options?.requireEnabled ?? false,
        tx: options?.tx,
      }),

    unpublish: async (itemId, locale, options) =>
      await transition(itemId, locale, options ?? {}, {
        guard: eq(statusColumn(), "published"),
        // Deliberately not `requireEnabled`: an administrator switching a
        // language off next wants to take its pages down, and refusing that
        // would leave published content in a locale nobody can edit.
        requireEnabled: false,
        // `publishedAt` survives on purpose: it records when this language was
        // first published, which stays true after it is taken down again.
        values: { status: "draft" },
      }),

    update: async (itemId, locale, values, options) => {
      const target = await language(locale, {
        requireEnabled: true,
        tx: options.tx,
      });
      const database = db(options);

      // Parsed before the row is read, so an invalid payload never costs a
      // query. Slugs are normalised before the diff, so re-sending the stored
      // slug in a different case counts as no change rather than a pointless
      // write.
      const parsed = schemas.update.parse(values);
      const patch = withUpdateSlugs(
        contentValuesToColumns(localizedFields, parsed),
      );

      const current = await readOne(itemId, target.id, database);
      if (!current) return null;

      // Diffed in **columns**, reported in canonical paths: `seo.description`
      // rather than `seoDescription`, so a translation's changed-field list
      // speaks the same vocabulary the base row's does.
      const changedColumns = diffChangedFields(localizedNames, current, patch);
      const changedFields = changedColumns.map(
        name => pathByColumn.get(name) ?? name,
      ) as typeof changedColumns;

      // A no-op is a successful write that changed nothing: it must not bump the
      // version, must not move `updatedAt`, and must not fail on a stale
      // `expectedVersion` - there is nothing to overwrite, so there is nothing
      // to conflict about. The same rule the base service already follows.
      if (changedFields.length === 0) {
        return {
          changed: false,
          changedFields,
          row: toRow(current, target.locale),
          version: versionOf(current),
        };
      }

      const [row] = await database
        .update(translationTable)
        .set({
          ...Object.fromEntries(changedColumns.map(key => [key, patch[key]])),
          version: sql`${versionColumn} + 1`,
        })
        .where(
          and(
            eq(itemColumn, itemId),
            eq(languageColumn, target.id),
            eq(versionColumn, options.expectedVersion),
          ),
        )
        .returning(fullSelection());

      if (!row) {
        // The row was there a moment ago, so this is a lost race rather than a
        // missing translation: another writer moved the version in between.
        const latest = await readOne(itemId, target.id, database);
        if (!latest) return null;

        throw new ContentTranslationVersionConflict({
          contentTypeId,
          currentVersion: versionOf(latest),
          expectedVersion: options.expectedVersion,
          itemId,
          locale: target.locale,
        });
      }

      return {
        changed: true,
        changedFields,
        row: toRow(row, target.locale),
        version: versionOf(row),
      };
    },
  };
};

/** The language registry keyed by id, for turning a stored FK back into a locale. */
const listContentLanguagesById = async (
  c: Context,
  tx?: ContentDatabase,
): Promise<Map<number, ContentLanguage>> =>
  new Map(
    (await listContentLanguages(c, tx)).map(language => [
      language.id,
      language,
    ]),
  );
