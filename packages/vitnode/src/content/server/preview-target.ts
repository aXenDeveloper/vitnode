import type { Context } from "hono";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

export interface ContentPreviewTarget {
  /** `core_languages.id` of `locale`. Present exactly when `locale` is. */
  languageId?: number;
  /** The language this preview is bound to, on a localized content type. */
  locale?: string;
  /** The public slug of the record in that language. */
  slug?: string;
}

const stringValue = (source: unknown, key: string): string | undefined => {
  if (typeof source !== "object" || source === null) return undefined;

  const value = (source as Record<string, unknown>)[key];

  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

const previewSlugField = (definition: AnyContentTypeDefinition): string =>
  definition.delivery.enabled && definition.publicApi.enabled
    ? definition.publicApi.slugField
    : "";

export const resolveContentPreviewTarget = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  { id, row }: { id: number; row: unknown },
): Promise<ContentPreviewTarget> => {
  const { definition } = model;
  const slugField = previewSlugField(definition);

  if (!definition.localization.enabled) {
    return slugField === "" ? {} : { slug: stringValue(row, slugField) };
  }

  const buildTranslations = model.translationService;
  if (!buildTranslations) return {};

  const translation = await buildTranslations(c).findByLocale(
    id,
    definition.localization.defaultLocale,
  );
  if (!translation) return {};

  // A shared slug is a base column, so it comes off the row the caller already
  // has. A localized one is the whole reason each language has its own URL.
  const slug =
    slugField === ""
      ? undefined
      : definition.delivery.slugScope === "shared"
        ? stringValue(row, slugField)
        : stringValue(translation.values, slugField);

  return {
    languageId: translation.languageId,
    locale: translation.locale,
    slug,
  };
};

export const resolveContentTranslationPreviewSlug = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  { id, values }: { id: number; values: unknown },
): Promise<string | undefined> => {
  const { definition } = model;
  const slugField = previewSlugField(definition);
  if (slugField === "") return undefined;

  if (definition.delivery.slugScope === "shared") {
    return stringValue(await model.service(c).findById(id), slugField);
  }

  return stringValue(values, slugField);
};
