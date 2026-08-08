import type { AnyContentTypeDefinition } from "./types";

import {
  CONTENT_SEARCH_LOCALE_PLACEHOLDER,
  CONTENT_SEARCH_SLUG_PLACEHOLDER,
} from "./const";
import { isContentRelationCollection, splitContentFieldPath } from "./paths";

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

/**
 * Everything a `changedFields` entry may name that would change the document.
 *
 * The indexed names, plus the **container** of every indexed leaf path. A
 * repeatable reports itself whole (`faq`) when its children move, while the
 * configuration names leaves (`faq.question`), so without the container the
 * synchronizer would decide a rewritten answer changed nothing. A group is the
 * other way round - it reports leaves and is configured by leaves - so its
 * container simply never appears in a diff and adding it costs nothing.
 */
export const contentSearchIndexedPaths = (
  definition: AnyContentTypeDefinition,
): Set<string> => {
  const names = contentSearchIndexedFieldNames(definition);

  return new Set(
    names.flatMap(name => {
      const path = splitContentFieldPath(name);

      return path ? [name, path[0]] : [name];
    }),
  );
};

/**
 * Whether any indexed field lives in a generated collection table.
 *
 * The one question that decides whether the effects layer has to read a
 * record's collections back after a write: a document made of `faq.answer` is
 * made of child rows, and those are not on the row the mutation returned. A
 * content type that indexes none - which is every Stage 1-5 one - reads nothing
 * extra, ever.
 */
export const contentSearchIndexesCollections = (
  definition: AnyContentTypeDefinition,
): boolean =>
  contentSearchIndexedFieldNames(definition).some(name => {
    const path = splitContentFieldPath(name);
    if (!path) return false;

    const fieldValue = definition.fields[path[0]];

    return (
      fieldValue !== undefined &&
      (fieldValue.kind === "repeatable" ||
        isContentRelationCollection(fieldValue))
    );
  });
