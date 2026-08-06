import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, sql } from "drizzle-orm";

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

import { CONTENT_TRANSLATION_SYSTEM_FIELDS } from "../const";
import {
  ContentDefaultTranslationRequired,
  ContentEngineError,
  ContentTranslationExists,
  ContentTranslationItemMissing,
  ContentTranslationVersionConflict,
} from "../errors";
import { partitionContentFields } from "../localization";
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

/**
 * One localized content type's translation repository.
 *
 * Deliberately low level. It writes translation rows and enforces the rules that
 * belong to the data - per-locale versioning, the default-translation invariant,
 * slug normalisation - and does **nothing else**: no event, no cache tag, no
 * search document, no revision. Stage 5B orchestrates those on top, the same way
 * `contentEditorialEffects` does for the base row today. A repository that
 * emitted events could not be called inside somebody else's transaction, which is
 * exactly what atomic create needs it to be.
 */
export interface ContentTranslationModel<TDefinition> {
  /** Inserts one translation at version 1. Throws if the locale already has one. */
  create: (
    itemId: number,
    locale: string,
    values: ContentLocalizedValues<TDefinition>,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationRow<TDefinition>>;
  /**
   * Removes one translation, guarded by its version.
   *
   * `null` when there is no such translation - the caller wanted it gone, and it
   * is. Refuses the default locale outright: that translation is created with the
   * record and is what makes "a record always resolves in some language" true.
   */
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
  /** Metadata for every translation of one record, without the values. */
  findManyForItem: (
    itemId: number,
    options?: ContentTranslationOptions,
  ) => Promise<ContentTranslationMeta[]>;
  /** The language this content type creates records in. */
  resolveDefaultLanguage: (
    options?: ContentTranslationOptions,
  ) => Promise<ContentLanguage>;
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
  const localizedNames = Object.keys(
    localizedFields,
  ) as ContentLocalizedFieldName<TDefinition>[];
  const { defaultLocale } = definition.localization;

  const itemColumn = columns.itemId;
  const languageColumn = columns.languageId;
  const versionColumn = columns.version;
  const baseId = (table as unknown as Record<string, PgColumn>).id;

  // The same normaliser the base service uses, over the localized half of the
  // field map. Two slug algorithms is exactly the pair that drifts, and the
  // consequence would be `/en/my-post` and `/pl/my_post`.
  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    localizedFields,
  );

  const metaSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(
      translationSystemFields.map(name => [name, columns[name]]),
    );

  const fullSelection = (): Record<string, PgColumn> => ({
    ...metaSelection(),
    ...Object.fromEntries(localizedNames.map(name => [name, columns[name]])),
  });

  const db = (options?: ContentTranslationOptions): ContentDatabase =>
    contentDatabase(c, options?.tx);

  /**
   * Resolves a locale, reading the language registry through whatever handle the
   * caller is using.
   *
   * The `tx` is load-bearing: inside `localizedService.create` the transaction
   * holds the connection, so a registry query issued on the client would wait for
   * a connection that transaction will not release until it has an answer.
   */
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

  /**
   * Splits a raw row into metadata and `values`.
   *
   * The nesting is not decoration: it keeps a localized field called `version` or
   * `locale` from being confused with the metadata of the row that holds it, and
   * it means the update request body (`{ expectedVersion, values }`) and the
   * response have the same shape.
   */
  const toRow = (
    row: Record<string, unknown>,
    locale: string,
  ): ContentTranslationRow<TDefinition> => {
    const values: Record<string, unknown> = {};
    for (const name of localizedNames) values[name] = row[name];

    return {
      createdAt: row.createdAt as Date,
      itemId: row.itemId as number,
      languageId: row.languageId as number,
      locale,
      updatedAt: row.updatedAt as Date,
      values: values as ContentLocalizedValues<TDefinition>,
      version: row.version as number,
    };
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

      const [row] = await database
        .insert(translationTable)
        .values({
          ...withCreateSlugs(parsed),
          itemId,
          languageId: target.id,
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

      return rows.map(row => ({
        createdAt: row.createdAt as Date,
        itemId: row.itemId as number,
        languageId: row.languageId as number,
        locale: languages.get(row.languageId as number)?.locale ?? "",
        updatedAt: row.updatedAt as Date,
        version: row.version as number,
      }));
    },

    resolveDefaultLanguage: async options =>
      await language(defaultLocale, {
        requireEnabled: true,
        tx: options?.tx,
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
      const patch = withUpdateSlugs(schemas.update.parse(values));

      const current = await readOne(itemId, target.id, database);
      if (!current) return null;

      const changedFields = diffChangedFields(localizedNames, current, patch);

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
          ...Object.fromEntries(changedFields.map(key => [key, patch[key]])),
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
