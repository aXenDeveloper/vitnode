import type { SearchDocument } from "../../api/models/search";
import type { AnyContentTypeDefinition } from "../types";

import {
  isContentPubliclyVisible,
  isContentTranslationPubliclyVisible,
} from "../cache";
import { partitionContentFields } from "../localization";
import { readContentPath, splitContentFieldPath } from "../paths";
import { contentSearchUrl } from "../search";

/** Collapses whitespace so a multi-line value cannot break a result heading. */
const normalize = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/**
 * One configured search field, resolved to text.
 *
 * Three shapes, one rule - what a reader would see, in the order they would see
 * it:
 *
 * - `"title"` is the value on the row;
 * - `"seo.description"` is the leaf of a group, or nothing when the group is
 *   `null`;
 * - `"faq.question"` is **every** child's leaf, joined in **position order**.
 *   Position order rather than insertion order, because position is what the
 *   page renders and an index that disagreed with the page would highlight the
 *   wrong entry. The join is a newline, so two entries never run together into a
 *   phrase neither of them contains.
 *
 * A relation is never here: `defineContentType` refuses one in every search
 * slot, and indexing foreign keys as text would make a record match a number
 * somebody typed into a search box.
 */
const readSearchValue = (
  values: Record<string, unknown>,
  name: string,
): string => {
  const path = splitContentFieldPath(name);
  if (!path) return normalize(values[name]);

  const [owner, leaf] = path;
  const container = values[owner];

  if (Array.isArray(container)) {
    return (container as Record<string, unknown>[])
      .map(child => normalize(child[leaf]))
      .filter(value => value !== "")
      .join("\n");
  }

  return normalize(readContentPath(values, name));
};

const toDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toTimestamp = (value: unknown): Date | null | string | undefined => {
  if (value instanceof Date || typeof value === "string") return value;

  return value === null ? null : undefined;
};

/**
 * Whether one row is currently publicly visible.
 *
 * {@link isContentPubliclyVisible} with the column coercion in front of it, so
 * "is this public" and "can this be indexed" stay two separate questions - a
 * published record whose title is blank is the first but not the second, and it
 * needs its stale document removed rather than left alone.
 */
export const isContentRowPublic = (row: object): boolean => {
  const values = row as Record<string, unknown>;

  return isContentPubliclyVisible({
    publishedAt: toTimestamp(values.publishedAt),
    status: normalize(values.status) || undefined,
  });
};

/**
 * Projects one content record into a search document.
 *
 * Returns `null` - not a partial document - whenever the record must not be
 * indexed: search is off, the row is not publicly visible, or the title or slug
 * is missing. Every caller treats `null` as "make sure nothing is indexed for
 * this record", so there is one decision and not one per call site.
 *
 * Visibility is {@link isContentPubliclyVisible}, the same predicate the Server
 * Actions use to decide which cache tags to expire. The engine has exactly two
 * definitions of "public" - that one and `publishedCondition` in SQL - and this
 * adds no third.
 *
 * Nothing outside `publicApi.fields` can reach the document: `defineContentType`
 * has already proven every indexed field name is in that allowlist, so a private
 * column cannot be read here even by mistake.
 *
 * `row` is `object` rather than `ContentSelect<TDefinition>` because columns are
 * read by a name resolved at runtime, and an unresolved generic row type is not
 * assignable to an index signature - typing it strictly would push a cast to
 * every call site instead of keeping the one honest cast here.
 */
export const contentSearchDocument = (
  definition: AnyContentTypeDefinition,
  row: object,
  { locale, pluginId }: { locale?: string; pluginId?: string } = {},
): null | SearchDocument => {
  const { publicApi, search } = definition;
  if (!search.enabled) return null;

  const values = row as Record<string, unknown>;

  const itemId = values.id;
  if (typeof itemId !== "number") return null;

  if (!isContentRowPublic(row)) return null;

  const title = normalize(readSearchValue(values, search.titleField));
  if (title === "") return null;

  const url = contentSearchUrl(
    definition,
    normalize(values[publicApi.slugField]),
    locale,
  );
  if (url === null) return null;

  // A published row always carries `publishedAt`, so this resolves to the
  // publication date - which is the date the feed and the timeline sort by.
  const createdAt = toDate(values.publishedAt) ?? toDate(values.createdAt);
  if (!createdAt) return null;

  // The description leads the body so it shows up first in a result excerpt.
  // Skipped when it is already one of the content fields, so it is not indexed
  // twice and does not distort ranking.
  const sources = search.contentFields.includes(search.descriptionField ?? "")
    ? search.contentFields
    : [
        ...(search.descriptionField ? [search.descriptionField] : []),
        ...search.contentFields,
      ];

  return {
    // `SearchModel.index` strips HTML from `content` (but never from `title`,
    // which is why the title is normalized above).
    content: sources
      .map(name => normalize(readSearchValue(values, name)))
      .filter(value => value !== "")
      .join("\n\n"),
    createdAt,
    // Only publicly visible rows get this far, and an unpublished record is
    // deleted from the index rather than hidden in it.
    isPublic: true,
    itemId,
    // Content type ids are globally unique and already namespaced as
    // `plugin.entity`, so the id alone is a collision-free item type.
    itemType: definition.id,
    // The owning plugin, so a rebuild - which runs in the core cron request -
    // stores the same ownership a live write did.
    ...(pluginId === undefined ? {} : { pluginId }),
    // `""` for a content type that is not localized - the language-agnostic
    // value that matches every locale, and what every document written before
    // Stage 5D already carries. A localized one is indexed once per language.
    ...(locale === undefined || locale === "" ? {} : { languageCode: locale }),
    // Deliberately absent: `authorId` (a `user` field can never be public, and
    // the public search route resolves it into a person), `containerType` /
    // `containerId` (there is no `containerType` query filter to qualify them
    // with), and `metadata` (nothing reads it).
    title,
    updatedAt: toDate(values.updatedAt),
    url,
  };
};

/**
 * Projects one *translation* into a search document.
 *
 * A localized record is indexed **once per published translation**, and each
 * document is the two halves of the page the reader would land on: shared values
 * off the base row, localized ones off the translation. Indexing the base row
 * alone would put one language in the index and rank every other one as a miss.
 *
 * Visibility is {@link isContentTranslationPubliclyVisible} - the base row *and*
 * the translation both published - which is the same subordination the public
 * read enforces in SQL. A translation is never indexed for a draft record, in any
 * language.
 *
 * `createdAt` is this language's publication date when it has one, so "newest"
 * sorts a late translation where it actually appeared rather than where its
 * record did.
 *
 * Returns `null` for everything that must not be indexed, so every caller has one
 * decision to make: "make sure nothing is indexed for this record in this
 * language".
 */
export const contentTranslationSearchDocument = (
  definition: AnyContentTypeDefinition,
  {
    base,
    locale,
    translation,
  }: { base: object; locale: string; translation: object },
  { pluginId }: { pluginId?: string } = {},
): null | SearchDocument => {
  if (!definition.search.enabled || !definition.localization.enabled) {
    return null;
  }

  const baseValues = base as Record<string, unknown>;
  const translationValues = translation as Record<string, unknown>;

  if (
    !isContentTranslationPubliclyVisible({
      base: {
        publishedAt: toTimestamp(baseValues.publishedAt),
        status: normalize(baseValues.status) || undefined,
      },
      translation: {
        publishedAt: toTimestamp(translationValues.publishedAt),
        status: normalize(translationValues.status) || undefined,
      },
    })
  ) {
    return null;
  }

  const { localizedFields } = partitionContentFields(definition.fields);
  // The localized half wins, and only for declared localized fields: a
  // translation row also carries its own `createdAt`, `version` and publication
  // state, and letting those through would describe the translation rather than
  // the page.
  const merged: Record<string, unknown> = { ...baseValues };
  for (const name of Object.keys(localizedFields)) {
    merged[name] = translationValues[name];
  }

  // `publishedAt` decides the document's date, and this language's is the honest
  // one. The status is already known to be published on both halves.
  merged.publishedAt = translationValues.publishedAt ?? baseValues.publishedAt;
  merged.updatedAt = translationValues.updatedAt ?? baseValues.updatedAt;

  return contentSearchDocument(definition, merged, { locale, pluginId });
};
