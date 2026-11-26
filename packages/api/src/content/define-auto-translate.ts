import type {
  ContentAutoTranslateInput,
  ContentFieldMap,
  ResolvedContentAutoTranslateConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import { ContentEngineError } from "./errors";

const DISABLED: ResolvedContentAutoTranslateConfig = {
  enabled: false,
  fields: [],
};

const OPTION_KEYS = new Set(["fields", "languageFrom"]);

/**
 * Resolves `autoTranslate`: which public rich-text fields readers may get
 * machine-translated, and which field's detected language stands in for a
 * short one. A localized field is only translated from the default language
 * served in place of a missing translation, so it needs
 * `localization.fallback: "default"`.
 */
export const resolveAutoTranslate = (
  id: string,
  autoTranslate: ContentAutoTranslateInput | undefined,
  {
    fields,
    localizationFallback,
    publicApi,
    publication,
  }: {
    fields: ContentFieldMap;
    /** `localization.fallback`, or `null` when the content type is not localized. */
    localizationFallback: null | string;
    publicApi: ResolvedContentPublicApiConfig;
    publication: boolean;
  },
): ResolvedContentAutoTranslateConfig => {
  if (autoTranslate === undefined || autoTranslate === false) return DISABLED;

  if (typeof autoTranslate !== "object" || autoTranslate === null) {
    throw new ContentEngineError(
      "autoTranslate is an options object with `fields`.",
      { contentTypeId: id },
    );
  }
  const unknownKey = Object.keys(autoTranslate).find(
    key => !OPTION_KEYS.has(key),
  );
  if (unknownKey) {
    throw new ContentEngineError(
      `autoTranslate.${unknownKey} is not an option. Use \`fields\` and \`languageFrom\`.`,
      { contentTypeId: id },
    );
  }
  if (!publicApi.enabled || !publication) {
    throw new ContentEngineError(
      "autoTranslate needs `publicApi` and `publication`: only published, public records are translated.",
      { contentTypeId: id },
    );
  }
  if (!publicApi.fields.includes("id")) {
    throw new ContentEngineError(
      "autoTranslate needs `id` in publicApi.fields: a page names each record it wants translated by its id.",
      { contentTypeId: id },
    );
  }
  if (autoTranslate.fields.length === 0) {
    throw new ContentEngineError("autoTranslate.fields lists no field.", {
      contentTypeId: id,
    });
  }

  const names = new Set(autoTranslate.fields);
  const resolved = [...names].map(name => {
    const descriptor = fields[name];
    if (descriptor?.kind !== "richText") {
      throw new ContentEngineError(
        `autoTranslate field "${name}" must be a richText field: only rich-text content is translated automatically, titles and other plain text stay as written.`,
        { contentTypeId: id },
      );
    }
    const localized = "localized" in descriptor && descriptor.localized;
    if (localized && localizationFallback !== "default") {
      throw new ContentEngineError(
        `autoTranslate field "${name}" is localized, which needs \`localization.fallback: "default"\`: only the default-language text served to a reader without an editorial translation is translated automatically.`,
        { contentTypeId: id },
      );
    }
    if (!publicApi.fields.includes(name)) {
      throw new ContentEngineError(
        `autoTranslate field "${name}" must be in publicApi.fields: a reader can only get a translation of what they can read.`,
        { contentTypeId: id },
      );
    }

    const languageFrom = autoTranslate.languageFrom?.[name] ?? null;
    if (languageFrom !== null && !names.has(languageFrom)) {
      throw new ContentEngineError(
        `autoTranslate.languageFrom.${name} names "${languageFrom}", which is not in autoTranslate.fields.`,
        { contentTypeId: id },
      );
    }

    return { languageFrom, localized, name };
  });

  return { enabled: true, fields: resolved };
};
