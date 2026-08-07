import type { AnyContentTypeDefinition } from "./types";

import {
  CONTENT_SEARCH_LOCALE_PLACEHOLDER,
  CONTENT_SEARCH_SLUG_PLACEHOLDER,
} from "./const";

/**
 * The public URL of one record, for a search hit.
 *
 * `null` for an empty slug rather than a throw: a slug column is `NOT NULL` and
 * `slugify` rejects a value that folds to nothing, so this is unreachable
 * through the engine - but a row written straight into the database must not
 * produce a link to `/articles/`.
 *
 * `encodeURIComponent` is defence in depth for the same reason. Substitution is
 * a single literal replace, and `defineContentType` has already proven the
 * template holds exactly one `{slug}` and no other placeholder.
 */
export const contentSearchUrl = (
  definition: AnyContentTypeDefinition,
  slug: string,
  locale?: string,
): null | string => {
  const trimmed = slug.trim();
  if (trimmed === "" || definition.search.pathTemplate === "") return null;

  const localized = definition.localization.enabled;
  const language = locale?.trim() ?? "";

  // A localized content type has one document per language and one URL per
  // language. Without a locale there is no URL to build, and a link to the wrong
  // language is worse than no link at all.
  if (localized && language === "") return null;

  const withSlug = definition.search.pathTemplate.replace(
    CONTENT_SEARCH_SLUG_PLACEHOLDER,
    encodeURIComponent(trimmed),
  );

  return localized
    ? withSlug.replace(
        CONTENT_SEARCH_LOCALE_PLACEHOLDER,
        encodeURIComponent(language),
      )
    : withSlug;
};

/**
 * A human-readable identifier for one search document, for log lines and the
 * AdminCP.
 *
 * **Not a storage key.** The search index identifies a document by
 * `(itemType, itemId, languageCode)`, and the content type id already carries
 * the plugin namespace (`plugin.entity`), so there is nothing for a second
 * identifier format to disambiguate.
 */
export const contentSearchDocumentId = (
  definition: AnyContentTypeDefinition,
  id: number,
  locale?: string,
): string =>
  locale === undefined || locale === ""
    ? `${definition.id}:${id}`
    : `${definition.id}:${id}:${locale}`;

/**
 * Every field whose value the search document is built from, including the slug
 * the URL is built from.
 *
 * Used to decide whether an update changed anything the index would notice, and
 * to project only these columns during a rebuild.
 */
export const contentSearchIndexedFieldNames = (
  definition: AnyContentTypeDefinition,
): string[] => {
  const { publicApi, search } = definition;
  if (!search.enabled) return [];

  return [
    ...new Set(
      [
        search.titleField,
        search.descriptionField,
        ...search.contentFields,
        publicApi.slugField,
      ].filter((name): name is string => Boolean(name)),
    ),
  ];
};
