import type { Context } from "hono";

import type { ContentActor } from "../revisions";
import type {
  AnyContentTypeDefinition,
  ContentLocalizedValues,
  ContentSelect,
  ContentSharedValues,
  ContentTranslationRow,
} from "../types";
import type { ContentDatabase, ContentService } from "./service";
import type { ContentTranslationEditorialService } from "./translation-editorial-service";
import type { ContentTranslationModel } from "./translation-model";

import { contentTypeName } from "../admin/labels";
import { ContentEngineError } from "../errors";

export interface ContentLocalizedCreateInput<TDefinition> {
  /** Values for the base table. */
  shared: ContentSharedValues<TDefinition>;
  /** Values for the default-locale translation created alongside it. */
  translation: ContentLocalizedValues<TDefinition>;
}

export interface ContentLocalizedCreateOptions {
  /**
   * Who is creating the record.
   *
   * Supply it on an editorial content type and the default translation gets its
   * own `create` revision, in the same transaction as the row - which is what
   * makes the earliest restorable English state the one the record was created
   * with. Without it (or without `editorial`) the translation is written through
   * the plain repository and leaves no history, exactly as in Stage 5A.
   */
  actor?: ContentActor;
  /**
   * The locale the first translation is written in. Defaults to - and, today,
   * may only be - the content type's configured default locale.
   */
  locale?: string;
  /** Join an existing transaction instead of opening one. */
  tx?: ContentDatabase;
}

export interface ContentLocalizedCreateResult<TDefinition> {
  row: ContentSelect<TDefinition>;
  translation: ContentTranslationRow<TDefinition>;
}

export interface ContentLocalizedService<TDefinition> {
  /**
   * Creates a base row and its default-locale translation, atomically.
   *
   * Either both exist or neither does. That is the invariant everything above
   * leans on: a record always resolves in at least one language, so the AdminCP
   * always has something to show, a public read always has something to fall
   * back to, and there is no such thing as an "empty" record whose title exists
   * in no language at all.
   */
  create: (
    input: ContentLocalizedCreateInput<TDefinition>,
    options?: ContentLocalizedCreateOptions,
  ) => Promise<ContentLocalizedCreateResult<TDefinition>>;
}

/**
 * The one write that spans both tables.
 *
 * Everything else about localization is either base-only (the plain service) or
 * translation-only (the translation model). Create is the exception, and it is
 * the reason this file exists rather than a third method on one of them.
 */
export const createContentLocalizedService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  definition,
  editorial,
  service,
  translations,
}: {
  c: Context;
  definition: TDefinition;
  /**
   * The translation editorial layer, when the content type has one.
   *
   * Optional so a localized content type without `editorial` keeps exactly the
   * Stage 5A behaviour: the default translation is written through the repository
   * and leaves no history, because there is no history to leave.
   */
  editorial?: ContentTranslationEditorialService<TDefinition>;
  service: ContentService<TDefinition>;
  translations: ContentTranslationModel<TDefinition>;
}): ContentLocalizedService<TDefinition> => {
  const contentTypeId = definition.id;

  if (!definition.localization.enabled) {
    throw new ContentEngineError(
      "The localized service needs `localization: { enabled: true, defaultLocale }` on the content type.",
      { contentTypeId },
    );
  }

  const { defaultLocale } = definition.localization;

  return {
    create: async ({ shared, translation }, options = {}) => {
      const locale = options.locale ?? defaultLocale;

      // A record always starts in its default language. Creating it straight
      // into Polish would leave the default translation missing - the one thing
      // the invariant above promises is always there - and every later stage
      // would need a "unless it was created in another locale" branch.
      if (locale.toLowerCase() !== defaultLocale.toLowerCase()) {
        throw new ContentEngineError(
          `A ${contentTypeName(definition.id)} is created in its default locale "${defaultLocale}", not "${locale}". Create it first, then add the "${locale}" translation.`,
          { contentTypeId },
        );
      }

      const run = async (
        tx: ContentDatabase,
      ): Promise<ContentLocalizedCreateResult<TDefinition>> => {
        // Resolved inside the transaction, so a default language that has just
        // been removed rolls the base insert back with it rather than leaving an
        // untranslatable row behind.
        const language = await translations.resolveDefaultLanguage({ tx });

        const row = await service.create(shared, { tx });

        // Through the editorial layer when there is one and an actor to attribute
        // it to, so the default translation's first values are restorable rather
        // than being the one state no revision ever recorded. Same transaction
        // either way: the base row and its default translation still commit or
        // roll back together.
        if (editorial && options.actor) {
          const outcome = await editorial.create(
            row.id,
            language.locale,
            translation,
            { actor: options.actor, tx },
          );

          return { row, translation: outcome.row };
        }

        const created = await translations.create(
          row.id,
          language.locale,
          translation,
          { tx },
        );

        return { row, translation: created };
      };

      if (options.tx) return await run(options.tx);

      return await c.get("db").transaction(async tx => await run(tx));
    },
  };
};
