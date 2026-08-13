import type { Context } from "hono";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

/**
 * What a base preview link should be minted *for*.
 *
 * A preview of a nonlocalized record is unambiguous: one row, one page, one
 * token. A localized record has neither - it has one row per language - so the
 * base mint route has to pick one, and this is where that choice is made once
 * rather than in each of the two places that needs it.
 *
 * `slug` is what turns the link into the record's own page instead of the JSON
 * endpoint. `locale` and `languageId` are what make the token *readable*: the
 * public preview route resolves a locale for every localized read, and a token
 * minted without one is refused by design - so a locale-less token on a localized
 * content type is a link that 404s no matter where it points.
 */
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

/**
 * The slug field a preview link is built from, or `""` when there is none.
 *
 * Empty for a content type with no delivery layer, because there is no canonical
 * page for a preview to point at - and asking for the slug would mean a query
 * whose answer nothing reads.
 */
const previewSlugField = (definition: AnyContentTypeDefinition): string =>
  definition.delivery.enabled && definition.publicApi.enabled
    ? definition.publicApi.slugField
    : "";

/**
 * The default locale's slug, and the language the link is bound to.
 *
 * **The default locale, not a negotiated one.** The AdminCP preview button says
 * "show me this record", and the record's default language is the only answer
 * that does not depend on who is holding the mouse - a link that previewed
 * whichever language the editor's browser happened to ask for would mean
 * something different for each person who clicked it.
 *
 * One extra read for a localized content type, because `languageId` exists
 * nowhere else. A nonlocalized one costs nothing: its slug is a column of the row
 * the caller already loaded.
 */
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

/**
 * The same slug, for a route that already knows which translation it is previewing.
 *
 * The locale-scoped mint route holds the translation and never loads the base
 * row, so a *shared* slug is the one case that costs a read here - and it is the
 * rarer shape, since `delivery.redirects` refuses a shared slug on a localized
 * content type outright.
 */
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
