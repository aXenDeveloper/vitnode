import type { SearchDocument } from "../../api/models/search";
import type { AnyContentTypeDefinition } from "../types";

import { isContentPubliclyVisible } from "../cache";
import { contentSearchUrl } from "../search";

/** Collapses whitespace so a multi-line value cannot break a result heading. */
const normalize = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

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
  { pluginId }: { pluginId?: string } = {},
): null | SearchDocument => {
  const { publicApi, search } = definition;
  if (!search.enabled) return null;

  const values = row as Record<string, unknown>;

  const itemId = values.id;
  if (typeof itemId !== "number") return null;

  if (!isContentRowPublic(row)) return null;

  const title = normalize(values[search.titleField]);
  if (title === "") return null;

  const url = contentSearchUrl(
    definition,
    normalize(values[publicApi.slugField]),
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
      .map(name => normalize(values[name]))
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
    // Deliberately absent: `authorId` (a `user` field can never be public, and
    // the public search route resolves it into a person), `containerType` /
    // `containerId` (there is no `containerType` query filter to qualify them
    // with), and `metadata` (nothing reads it). Also `languageCode`, which
    // defaults to "" - the language-agnostic value that matches every locale.
    title,
    updatedAt: toDate(values.updatedAt),
    url,
  };
};
