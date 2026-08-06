import { CONTENT_CACHE_TAG_MAX_LENGTH } from "./const";
import { clampWithFingerprint } from "./fingerprint";

/**
 * Cache tags for the generated public API.
 *
 * Pure strings, no `next/*`, and exported: an app can tag its own `fetch` calls
 * and its own `"use cache"` functions with exactly the same values, which is
 * the only way its pages get invalidated alongside the generated ones.
 *
 * Format: `content:{contentTypeId}:{scope}[:{key}]`. No plugin id - a content
 * type id is already globally unique (`validateContentTypes` enforces it) and
 * already namespaced, as in `example.article`.
 *
 * Next caps a tag at 256 characters and a slug can be 160, so every builder
 * runs its result through the same fingerprint clamp the index names use.
 * Deterministic, collision-resistant, no new dependency.
 */
const tag = (...parts: (number | string)[]): string =>
  clampWithFingerprint(
    ["content", ...parts.map(String)].join(":"),
    CONTENT_CACHE_TAG_MAX_LENGTH,
  );

/** Every public list page of one content type. */
export const contentPublicListTag = (contentTypeId: string): string =>
  tag(contentTypeId, "list");

/** One row, by identifier. */
export const contentPublicItemTag = (
  contentTypeId: string,
  id: number,
): string => tag(contentTypeId, "item", id);

/** One row, by the URL it answers to. */
export const contentPublicSlugTag = (
  contentTypeId: string,
  slug: string,
): string => tag(contentTypeId, "slug", slug);

/**
 * How hard a mutation expires the tags it touched.
 *
 * Lives here, in the client-safe layer, because the background
 * [bridge](./server/revalidate-bridge.ts) has to name a mode from a process
 * where `next/cache` cannot even be imported. `content/next` re-exports it, so
 * the public name has not moved.
 */
export type ContentInvalidationMode = "immediate" | "stale-while-revalidate";

export interface ContentInvalidationInput {
  contentTypeId: string;
  id: number;
  /** Whether the row is publicly reachable *after* the mutation. */
  isPublic: boolean;
  /**
   * Every slug the row answered to across the mutation. On a slug change that
   * is two: the old URL has to stop resolving, and the new one has to start.
   */
  slugs: readonly string[];
  /** Whether it was publicly reachable *before*. */
  wasPublic: boolean;
}

/**
 * The exact tags one mutation should invalidate - and no others.
 *
 * Nothing global is ever returned, and one content type's mutation never
 * touches another's tags. A row that was private before and is private after
 * touches nothing at all: creating a draft, or editing one, changes no public
 * response, so invalidating a public list for it would just throw away a warm
 * cache for free.
 *
 * Pure, so the whole matrix is a table test rather than a mocking exercise.
 */
export const contentInvalidationTags = ({
  contentTypeId,
  id,
  isPublic,
  slugs,
  wasPublic,
}: ContentInvalidationInput): string[] => {
  if (!wasPublic && !isPublic) return [];

  return [
    contentPublicListTag(contentTypeId),
    contentPublicItemTag(contentTypeId, id),
    ...[...new Set(slugs)]
      .filter(slug => slug !== "")
      .map(slug => contentPublicSlugTag(contentTypeId, slug)),
  ];
};

/**
 * Whether a row is reachable through the public API right now.
 *
 * The JavaScript half of `publishedCondition`, kept in the client-safe layer so
 * a server action can answer "was this public?" from a mutation response
 * without a second query. Both read the same three clauses; the SQL one is
 * still what the database enforces.
 */
export const isContentPubliclyVisible = ({
  publishedAt,
  status,
}: {
  publishedAt: Date | null | string | undefined;
  status: string | undefined;
}): boolean => {
  if (status !== "published" || publishedAt === null) return false;
  if (publishedAt === undefined) return false;

  const date =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);

  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
};
