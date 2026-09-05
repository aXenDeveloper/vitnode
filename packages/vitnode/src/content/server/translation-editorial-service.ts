import type { Context } from "hono";

import type {
  ContentActor,
  ContentRevisionMeta,
  ContentTranslationRevisionOperation,
  ContentTranslationRevisionSnapshot,
} from "../revisions";
import type { ContentTranslationSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentLocalizedFieldName,
  ContentLocalizedUpdateValues,
  ContentLocalizedValues,
  ContentTranslationRow,
} from "../types";
import type { ContentDeliveryOutcome } from "./delivery-writes";
import type { ContentLanguage } from "./language-resolver";
import type {
  ContentRevisionPage,
  ContentRevisionsModel,
} from "./revisions-model";
import type { ContentDatabase } from "./service";
import type { ContentTranslationModel } from "./translation-model";

import { isContentTranslationPubliclyVisible } from "../cache";
import {
  ContentEngineError,
  ContentRevisionNotRestorable,
  ContentTranslationVersionConflict,
} from "../errors";
import { partitionContentFields } from "../localization";
import {
  contentFieldPath,
  contentInnerFields,
  splitContentFieldPath,
} from "../paths";
import {
  applyContentDeliveryWrite,
  contentSlugHistoryFor,
} from "./delivery-writes";
import { diffChangedPaths } from "./query";
import {
  contentTranslationRevisionSnapshot,
  projectTranslationRevisionSnapshot,
} from "./revision-snapshot";
import { createContentRevisionsModel } from "./revisions-model";
import { createSlugNormalizer } from "./slugs";
import { CONTENT_TRANSLATION_INITIAL_VERSION } from "./translation-model";

export interface ContentTranslationEditorialOutcome<TDefinition> {
  /** `false` when nothing moved: no write, no revision, no event, no tags. */
  changed: boolean;
  changedFields: ContentLocalizedFieldName<TDefinition>[];

  delivery?: ContentDeliveryOutcome;
  languageId: number;
  /** The canonical `core_languages.code`, never the caller's casing. */
  locale: string;
  operation: ContentTranslationRevisionOperation;
  /** The localized slug this translation answered to *before* the mutation. */
  previousSlug: null | string;
  restoredFromRevisionId: null | number;
  /** `null` on a no-op, since no revision was written. */
  revisionId: null | number;
  row: ContentTranslationRow<TDefinition>;
  version: number;
}

export interface ContentTranslationEditorialOptions {
  actor: ContentActor;
  /** Join an existing transaction instead of opening one. */
  tx?: ContentDatabase;
}

export interface ContentTranslationEditorialWriteOptions extends ContentTranslationEditorialOptions {
  expectedVersion: number;
}

/**
 * Publish and unpublish guard on the state, so the version is optional - the same
 * rule, and the same reasoning, as the base row's transitions.
 */
export interface ContentTranslationEditorialTransitionOptions extends ContentTranslationEditorialOptions {
  expectedVersion?: number;
}

export interface ContentTranslationEditorialService<TDefinition> {
  /** Adds a translation and records its `create` revision. Starts as a draft. */
  create: (
    itemId: number,
    locale: string,
    values: ContentLocalizedValues<TDefinition>,
    options: ContentTranslationEditorialOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition>>;

  delete: (
    itemId: number,
    locale: string,
    options: ContentTranslationEditorialWriteOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition> | null>;
  /** One revision of one locale, with its snapshot. Scoped by both. */
  findRevision: (
    itemId: number,
    locale: string,
    revisionId: number,
  ) => Promise<ContentRevisionDetailForLocale | null>;
  /** One locale's history, newest first. Metadata only. */
  listRevisions: (
    itemId: number,
    locale: string,
    args?: { cursor?: number; limit?: number },
  ) => Promise<ContentRevisionPage>;
  publish: (
    itemId: number,
    locale: string,
    options: ContentTranslationEditorialTransitionOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition> | null>;

  restore: (
    itemId: number,
    locale: string,
    revisionId: number,
    options: ContentTranslationEditorialWriteOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition> | null>;
  unpublish: (
    itemId: number,
    locale: string,
    options: ContentTranslationEditorialTransitionOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition> | null>;
  update: (
    itemId: number,
    locale: string,
    values: ContentLocalizedUpdateValues<TDefinition>,
    options: ContentTranslationEditorialWriteOptions,
  ) => Promise<ContentTranslationEditorialOutcome<TDefinition> | null>;
}

/** One translation revision with its snapshot, plus the locale it belongs to. */
export interface ContentRevisionDetailForLocale extends ContentRevisionMeta {
  locale: string;
  snapshot: ContentTranslationRevisionSnapshot;
}

export const createContentTranslationEditorialService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  definition,
  pluginId,
  schemas,
  translations,
}: {
  c: Context;
  definition: TDefinition;
  pluginId: string;
  schemas: ContentTranslationSchemas<TDefinition>;
  /** The repository this orchestrates. One instance per request, shared. */
  translations: ContentTranslationModel<TDefinition>;
}): ContentTranslationEditorialService<TDefinition> => {
  const contentTypeId = definition.id;

  if (!definition.localization.enabled) {
    throw new ContentEngineError(
      "The translation editorial service needs `localization: { enabled: true, defaultLocale }` on the content type.",
      { contentTypeId },
    );
  }

  if (!definition.editorial.enabled) {
    throw new ContentEngineError(
      "The translation editorial service needs `editorial: { enabled: true }` on the content type - without it there is no revision history for a translation to write to.",
      { contentTypeId },
    );
  }

  const { localizedFields } = partitionContentFields(definition.fields);

  const localizedPaths = Object.entries(localizedFields).flatMap(
    ([name, fieldValue]) =>
      fieldValue.kind === "group"
        ? Object.keys(contentInnerFields(fieldValue)).map(leaf =>
            contentFieldPath(name, leaf),
          )
        : [name],
  ) as ContentLocalizedFieldName<TDefinition>[];

  // The localized slug, if there is one. A content type may declare at most one
  // per language in practice; the first is what a URL is built from, and it is
  // what the locale-scoped cache tag keys off in Stage 5C.
  const slugField =
    Object.keys(localizedFields).find(
      name => localizedFields[name].kind === "slug",
    ) ?? null;

  const { withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    localizedFields,
  );

  // Only a **localized** slug is this service's business. A shared one is a column
  // on the base row, so a translation mutation cannot move it - see the base
  // editorial service, which owns that history.
  const deliveryEnabled =
    definition.delivery.enabled &&
    definition.delivery.slugScope === "localized";
  const slugHistory = contentSlugHistoryFor({ c, definition, pluginId });

  const applyDelivery = async (
    tx: ContentDatabase,
    {
      after,
      before,
      itemId,
      languageId,
      locale,
    }: {
      after: ContentTranslationRow<TDefinition> | null;
      before: ContentTranslationRow<TDefinition> | null;
      itemId: number;
      languageId: number;
      locale: string;
    },
  ): Promise<ContentDeliveryOutcome | undefined> => {
    if (!deliveryEnabled) return undefined;

    const base = (await translations.findBasePublication(itemId, { tx })) ?? {
      publishedAt: null,
      status: undefined,
    };
    const visible = (
      row: ContentTranslationRow<TDefinition> | null,
    ): boolean => {
      if (row === null) return false;

      return isContentTranslationPubliclyVisible({
        base,
        translation: {
          publishedAt: (row as { publishedAt?: Date | null }).publishedAt,
          status: (row as { status?: string }).status,
        },
      });
    };

    return await applyContentDeliveryWrite({
      definition,
      slugHistory,
      transition: {
        isPublic: visible(after),
        itemId,
        languageId,
        locale,
        previousSlug: slugOf(before),
        slug: slugOf(after),
        wasPublic: visible(before),
      },
      tx,
    });
  };

  const invertTranslation = (
    operation: "publish" | "unpublish",
    row: ContentTranslationRow<TDefinition>,
  ): ContentTranslationRow<TDefinition> => ({
    ...row,
    status: operation === "publish" ? "draft" : "published",
  });

  const revisionsFor = (
    languageId: number,
  ): ContentRevisionsModel<ContentTranslationRevisionSnapshot> =>
    createContentRevisionsModel<ContentTranslationRevisionSnapshot>({
      c,
      definition,
      languageId,
      pluginId,
    });

  const language = async (
    locale: string,
    { requireEnabled, tx }: { requireEnabled: boolean; tx?: ContentDatabase },
  ): Promise<ContentLanguage> =>
    await translations.resolveLanguage(locale, { requireEnabled, tx });

  const transact = async <TResult>(
    options: ContentTranslationEditorialOptions,
    body: (tx: ContentDatabase) => Promise<TResult>,
  ): Promise<TResult> => {
    if (options.tx) return await body(options.tx);

    return await c.get("db").transaction(async tx => await body(tx));
  };

  const slugOf = (
    row: ContentTranslationRow<TDefinition> | null,
  ): null | string => {
    if (!row || slugField === null) return null;
    const value = (row.values as Record<string, unknown>)[slugField];

    return typeof value === "string" ? value : null;
  };

  /** The raw column values a snapshot is taken from, flattened out of the row. */
  const snapshotSource = (
    row: ContentTranslationRow<TDefinition>,
  ): Record<string, unknown> => ({
    ...(row.values as Record<string, unknown>),
    createdAt: row.createdAt,
    itemId: row.itemId,
    languageId: row.languageId,
    publishedAt: (row as { publishedAt?: Date | null }).publishedAt ?? null,
    status: (row as { status?: string }).status,
    updatedAt: row.updatedAt,
    version: row.version,
  });

  const capture = async (
    tx: ContentDatabase,
    {
      actor,
      changedFields,
      languageId,
      locale,
      operation,
      restoredFromRevisionId,
      row,
      version,
    }: {
      actor: ContentActor;
      changedFields: readonly string[];
      languageId: number;
      locale: string;
      operation: ContentTranslationRevisionOperation;
      restoredFromRevisionId?: number;
      row: ContentTranslationRow<TDefinition>;
      version: number;
    },
  ): Promise<number> =>
    await revisionsFor(languageId).capture(tx, {
      actor,
      changedFields,
      itemId: row.itemId,
      operation,
      restoredFromRevisionId,
      snapshot: contentTranslationRevisionSnapshot(
        definition,
        { ...snapshotSource(row), version },
        { languageId, locale },
      ),
      version,
    });

  const unchanged = (
    operation: ContentTranslationRevisionOperation,
    row: ContentTranslationRow<TDefinition>,
  ): ContentTranslationEditorialOutcome<TDefinition> => ({
    changed: false,
    changedFields: [],
    languageId: row.languageId,
    locale: row.locale,
    operation,
    previousSlug: slugOf(row),
    restoredFromRevisionId: null,
    revisionId: null,
    row,
    version: row.version,
  });

  /** Publish and unpublish, which differ only in which model method they call. */
  const transition = async (
    itemId: number,
    locale: string,
    options: ContentTranslationEditorialTransitionOptions,
    operation: "publish" | "unpublish",
  ): Promise<ContentTranslationEditorialOutcome<TDefinition> | null> =>
    await transact(options, async tx => {
      const result = await translations[operation](itemId, locale, {
        expectedVersion: options.expectedVersion,
        tx,
      });
      if (!result) return null;
      if (!result.changed) return unchanged(operation, result.row);

      const revisionId = await capture(tx, {
        actor: options.actor,
        changedFields: [],
        languageId: result.row.languageId,
        locale: result.row.locale,
        operation,
        row: result.row,
        version: result.version,
      });

      // Publishing a language is the moment its address becomes live, so this is
      // where the reservation is taken. Unpublishing writes nothing: the history
      // stays, and the resolver stops redirecting to it because it reads the live
      // publication state rather than the history.
      const delivery = await applyDelivery(tx, {
        after: result.row,
        before: invertTranslation(operation, result.row),
        itemId: result.row.itemId,
        languageId: result.row.languageId,
        locale: result.row.locale,
      });

      return {
        changed: true,
        changedFields: [],
        ...(delivery === undefined ? {} : { delivery }),
        languageId: result.row.languageId,
        locale: result.row.locale,
        operation,
        previousSlug: slugOf(result.row),
        restoredFromRevisionId: null,
        revisionId,
        row: result.row,
        version: result.version,
      };
    });

  return {
    create: async (itemId, locale, values, options) =>
      await transact(options, async tx => {
        // Resolved here, before the write, because the version this translation
        // starts at is a fact about *this locale's* history - and history is
        // keyed by language id, which only the registry can supply.
        const target = await language(locale, { requireEnabled: true, tx });

        // A translation row is deleted physically; its history is not. Starting
        // a recreated locale at 1 would collide with the `create` revision the
        // first life wrote, so the new row picks up where the old one left off:
        // create 1, update 2, delete 3, recreate 4. Read inside the transaction,
        // so the number cannot be taken by another writer in between.
        const previous = await revisionsFor(target.id).latest(itemId, tx);

        const row = await translations.create(itemId, target.locale, values, {
          [CONTENT_TRANSLATION_INITIAL_VERSION]: (previous?.version ?? 0) + 1,
          tx,
        });

        const revisionId = await capture(tx, {
          actor: options.actor,
          // Everything is new, so every localized field "changed" - which is
          // what the history should say about a create.
          changedFields: localizedPaths,
          languageId: row.languageId,
          locale: row.locale,
          operation: "create",
          row,
          version: row.version,
        });

        // A new translation starts as a draft, so it reserves nothing - but its slug
        // is checked, because "that address belongs to an article that moved" is far
        // better heard now than at publish time.
        const delivery = await applyDelivery(tx, {
          after: row,
          before: null,
          itemId: row.itemId,
          languageId: row.languageId,
          locale: row.locale,
        });

        // ...unless the record it belongs to is already published, in which case
        // this language is published with it. Publication is the record's decision
        // - publishing a record moves every language it has - so a language added
        // afterwards that stayed a draft would be a language nothing can publish.
        // It goes through the ordinary transition, in this transaction, so it
        // reserves its address and records the publish in its own history exactly
        // as any other publish does.
        const base = await translations.findBasePublication(itemId, { tx });
        const published =
          base?.status === "published"
            ? await transition(
                itemId,
                row.locale,
                { actor: options.actor, tx },
                "publish",
              )
            : null;
        const live = published?.changed === true ? published : null;
        const outcome = live?.delivery ?? delivery;

        return {
          changed: true,
          changedFields: localizedPaths,
          ...(outcome === undefined ? {} : { delivery: outcome }),
          languageId: row.languageId,
          locale: row.locale,
          operation: "create" as const,
          previousSlug: null,
          restoredFromRevisionId: null,
          revisionId,
          row: live?.row ?? row,
          version: live?.version ?? row.version,
        };
      }),

    delete: async (itemId, locale, options) =>
      await transact(options, async tx => {
        const row = await translations.delete(itemId, locale, {
          expectedVersion: options.expectedVersion,
          tx,
        });
        if (!row) return null;

        // The row is gone, so no version survives to hold this one. Recording
        // `version + 1` keeps the per-locale history strictly increasing and the
        // partial unique index meaningful - the alternative collides with the
        // revision that last wrote this version.
        const version = row.version + 1;
        const revisionId = await capture(tx, {
          actor: options.actor,
          changedFields: [],
          languageId: row.languageId,
          locale: row.locale,
          operation: "delete",
          row,
          version,
        });

        // The history of a deleted translation is kept, exactly as a deleted
        // record's is: the URL existed, and the resolver answers 404 for it by
        // finding no live translation rather than by having forgotten it.
        const delivery = await applyDelivery(tx, {
          after: null,
          before: row,
          itemId: row.itemId,
          languageId: row.languageId,
          locale: row.locale,
        });

        return {
          changed: true,
          changedFields: [],
          ...(delivery === undefined ? {} : { delivery }),
          languageId: row.languageId,
          locale: row.locale,
          operation: "delete" as const,
          previousSlug: slugOf(row),
          restoredFromRevisionId: null,
          revisionId,
          row,
          version,
        };
      }),

    findRevision: async (itemId, locale, revisionId) => {
      // The language is resolved without `requireEnabled`: reading the history of
      // a locale the install has switched off is exactly what somebody auditing
      // it would want to do.
      const target = await language(locale, { requireEnabled: false });
      const revision = await revisionsFor(target.id).findById(
        itemId,
        revisionId,
      );
      if (!revision) return null;

      return { ...revision, locale: target.locale };
    },

    listRevisions: async (itemId, locale, args) => {
      const target = await language(locale, { requireEnabled: false });

      return await revisionsFor(target.id).list(itemId, args);
    },

    publish: async (itemId, locale, options) =>
      await transition(itemId, locale, options, "publish"),

    restore: async (itemId, locale, revisionId, options) =>
      await transact(options, async tx => {
        const target = await language(locale, { requireEnabled: true, tx });

        // Scoped by content type, item *and* language before anything is read, so
        // a revision id belonging to another locale is simply not found - it is
        // never fetched and then rejected, which would leak that it exists.
        const revision = await revisionsFor(target.id).findById(
          itemId,
          revisionId,
          tx,
        );
        if (!revision) return null;

        const current = await translations.findByLanguageId(itemId, target.id, {
          tx,
        });
        if (!current) return null;

        const projected = projectTranslationRevisionSnapshot(
          definition,
          revision.snapshot,
        );

        // Validated against the *current* localized schemas, not the ones in
        // force when the snapshot was taken. A field that has since become
        // required and is absent from the snapshot fails here, before anything is
        // written, so a restore is all or nothing.
        const parsed = schemas.update.safeParse(projected);
        if (!parsed.success) {
          throw new ContentRevisionNotRestorable({
            contentTypeId,
            fields: [
              ...new Set(
                parsed.error.issues
                  .map(issue => String(issue.path[0] ?? ""))
                  .filter(name => name !== ""),
              ),
            ],
            revisionId,
          });
        }

        const patch = withUpdateSlugs(parsed.data);
        const currentValues = current.values as Record<string, unknown>;
        // Canonical paths, and group-aware: `current.values` is the *logical*
        // shape, so a scalar diff would compare two `seo` objects by identity and
        // report every restore as a change even when nothing moved.
        const changedFields = diffChangedPaths(
          localizedFields,
          currentValues,
          patch,
        ) as ContentLocalizedFieldName<TDefinition>[];

        if (changedFields.length === 0) {
          return {
            ...unchanged("restore", current),
            // Nothing was restored, so nothing was restored *from*.
            restoredFromRevisionId: null,
          };
        }

        // Through the model rather than a second `UPDATE` here: the slug
        // uniqueness, the version guard and the locale scope are all its rules,
        // and a restore that wrote around them could produce a duplicate URL.
        const result = await translations.update(
          itemId,
          target.locale,
          // Keyed by the *owner* of each changed path, so a group is written
          // whole: the projected snapshot is the group's complete historical
          // value, and writing one leaf of it would restore half a state.
          Object.fromEntries(
            [
              ...new Set(
                changedFields.map(
                  path => splitContentFieldPath(path)?.[0] ?? path,
                ),
              ),
            ].map(key => [key, patch[key]]),
          ) as ContentLocalizedUpdateValues<TDefinition>,
          { expectedVersion: options.expectedVersion, tx },
        );
        if (!result) return null;

        // Unreachable in practice - the diff above proved something moved, and the
        // update ran in this transaction - but a no-op here must not write a
        // revision claiming a restore happened.
        if (!result.changed) {
          return {
            ...unchanged("restore", result.row),
            restoredFromRevisionId: null,
          };
        }

        const newRevisionId = await capture(tx, {
          actor: options.actor,
          changedFields: result.changedFields,
          languageId: result.row.languageId,
          locale: result.row.locale,
          operation: "restore",
          restoredFromRevisionId: revisionId,
          row: result.row,
          version: result.version,
        });

        // A restore that brings an older localized slug back moves this language's
        // canonical URL exactly as an edit does - and one that changed no slug
        // writes nothing, which is why it runs after the diff proved something moved.
        const delivery = await applyDelivery(tx, {
          after: result.row,
          before: current,
          itemId: result.row.itemId,
          languageId: result.row.languageId,
          locale: result.row.locale,
        });

        return {
          changed: true,
          changedFields: result.changedFields,
          ...(delivery === undefined ? {} : { delivery }),
          languageId: result.row.languageId,
          locale: result.row.locale,
          operation: "restore" as const,
          previousSlug: slugOf(current),
          restoredFromRevisionId: revisionId,
          revisionId: newRevisionId,
          row: result.row,
          version: result.version,
        };
      }),

    unpublish: async (itemId, locale, options) =>
      await transition(itemId, locale, options, "unpublish"),

    update: async (itemId, locale, values, options) =>
      await transact(options, async tx => {
        // Read first, so the outcome can carry the slug this translation answered
        // to before the write - the one thing that cannot be recovered afterwards.
        const before = await translations.findByLocale(itemId, locale, { tx });

        const result = await translations.update(itemId, locale, values, {
          expectedVersion: options.expectedVersion,
          tx,
        });
        if (!result) return null;

        if (!result.changed) return unchanged("update", result.row);

        const revisionId = await capture(tx, {
          actor: options.actor,
          changedFields: result.changedFields,
          languageId: result.row.languageId,
          locale: result.row.locale,
          operation: "update",
          row: result.row,
          version: result.version,
        });

        // After the guarded write, so the reservation is only taken by the writer
        // that actually won this locale's version race.
        const delivery = await applyDelivery(tx, {
          after: result.row,
          before,
          itemId: result.row.itemId,
          languageId: result.row.languageId,
          locale: result.row.locale,
        });

        return {
          changed: true,
          changedFields: result.changedFields,
          ...(delivery === undefined ? {} : { delivery }),
          languageId: result.row.languageId,
          locale: result.row.locale,
          operation: "update" as const,
          previousSlug: slugOf(before),
          restoredFromRevisionId: null,
          revisionId,
          row: result.row,
          version: result.version,
        };
      }),
  };
};

/** Re-exported so a caller need not reach past this module for the conflict. */
export { ContentTranslationVersionConflict };
