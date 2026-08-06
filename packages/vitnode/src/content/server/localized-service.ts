import type { Context } from "hono";

import type {
  AnyContentTypeDefinition,
  ContentLocalizedValues,
  ContentSelect,
  ContentSharedValues,
  ContentTranslationRow,
} from "../types";
import type { ContentDatabase, ContentService } from "./service";
import type { ContentTranslationModel } from "./translation-model";

import { ContentEngineError } from "../errors";

export interface ContentLocalizedCreateInput<TDefinition> {
  /** Values for the base table. */
  shared: ContentSharedValues<TDefinition>;
  /** Values for the default-locale translation created alongside it. */
  translation: ContentLocalizedValues<TDefinition>;
}

export interface ContentLocalizedCreateOptions {
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
   * Either both exist or neither does. That is the invariant every later stage
   * leans on: a record always resolves in at least one language, so a locale tab
   * strip always has something to show, a public read always has something to
   * fall back to, and there is no such thing as an "empty" record whose title
   * exists in no language at all.
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
  service,
  translations,
}: {
  c: Context;
  definition: TDefinition;
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
          `A ${definition.admin.label.singular} is created in its default locale "${defaultLocale}", not "${locale}". Create it first, then add the "${locale}" translation.`,
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
