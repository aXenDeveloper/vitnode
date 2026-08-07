import type { ContentLocalizationFallback } from "./types";

import { CONTENT_CACHE_TAG_MAX_LENGTH } from "./const";
import { clampWithFingerprint } from "./fingerprint";
import { contentLocalesMatch, normalizeContentLocale } from "./locale";

/**
 * Cache tags for the generated public API.
 *
 * Pure strings, no `next/*`, and exported: an app can tag its own `fetch` calls
 * and its own `"use cache"` functions with exactly the same values, which is
 * the only way its pages get invalidated alongside the generated ones.
 *
 * Format: `content:{contentTypeId}:{scope}[:{locale}][:{key}]`. No plugin id - a
 * content type id is already globally unique (`validateContentTypes` enforces it)
 * and already namespaced, as in `example.article`.
 *
 * The locale segment is present **only for a localized content type**, so every
 * tag a Stage 1-4 content type has ever produced is byte-identical to what it
 * produced before. It sits after the scope rather than before it so the two forms
 * can never collide: `content:x:list` is three segments and
 * `content:x:list:pl` is four, whatever the locale happens to spell.
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

/**
 * The locale segment, normalized, or nothing at all.
 *
 * Normalized because `PL` and `pl` address the same page and must therefore
 * expire together - a tag is a string comparison, so the casing has to be settled
 * here rather than hoped for at every call site.
 */
const localeParts = (locale: string | undefined): string[] => {
  if (locale === undefined) return [];

  const normalized = normalizeContentLocale(locale);

  return normalized === "" ? [] : [normalized];
};

/**
 * Every public list page of one content type, in one locale.
 *
 * Per locale rather than global: publishing a Polish translation changes no
 * English list page, and throwing that cache away would be a cost with no
 * correctness to show for it.
 */
export const contentPublicListTag = (
  contentTypeId: string,
  locale?: string,
): string => tag(contentTypeId, "list", ...localeParts(locale));

/** One row, by identifier, in one locale. */
export const contentPublicItemTag = (
  contentTypeId: string,
  id: number,
  locale?: string,
): string => tag(contentTypeId, "item", ...localeParts(locale), id);

/**
 * One row, by the URL it answers to, in one locale.
 *
 * The locale is load-bearing here and not merely tidy: two languages routinely
 * answer to the *same* slug (`/en/about` and `/pl/about`), so a locale-less slug
 * tag would make one language's edit expire the other's page - and, worse, make
 * one language's publish appear to expire a page it never touched.
 */
export const contentPublicSlugTag = (
  contentTypeId: string,
  slug: string,
  locale?: string,
): string => tag(contentTypeId, "slug", ...localeParts(locale), slug);

/**
 * How hard a mutation expires the tags it touched.
 *
 * Lives here, in the client-safe layer, because the background
 * [bridge](./server/revalidate-bridge.ts) has to name a mode from a process
 * where `next/cache` cannot even be imported. `content/next` re-exports it, so
 * the public name has not moved.
 */
export type ContentInvalidationMode = "immediate" | "stale-while-revalidate";

/**
 * One locale's share of a mutation.
 *
 * `isPublic` means **reachable through the public API in this locale**, which for
 * a content type with `fallback: "default"` includes a locale that has no
 * translation of its own and is being served the default one. That is the whole
 * reason this is a flag rather than something derived from the translation row:
 * the question a cache tag answers is "was there a page here", not "was there a
 * row here".
 */
export interface ContentLocaleInvalidation {
  isPublic: boolean;
  locale: string;
  /** Every slug this locale answered to across the mutation. */
  slugs: readonly string[];
  wasPublic: boolean;
}

export interface ContentInvalidationInput {
  contentTypeId: string;
  id: number;
  /** Whether the row is publicly reachable *after* the mutation. */
  isPublic: boolean;
  /**
   * The locales this mutation affected, for a **localized** content type.
   *
   * When present it is authoritative and the three flat fields above are not
   * consulted: a localized content type has no locale-less public URL, so a tag
   * without a locale segment would name a page that does not exist. Absent - which
   * is every Stage 1-4 content type - the flat fields are the whole input and the
   * tags are exactly what they have always been.
   */
  locales?: readonly ContentLocaleInvalidation[];
  /**
   * Every slug the row answered to across the mutation. On a slug change that
   * is two: the old URL has to stop resolving, and the new one has to start.
   */
  slugs: readonly string[];
  /** Whether it was publicly reachable *before*. */
  wasPublic: boolean;
}

const slugTags = (
  contentTypeId: string,
  slugs: readonly string[],
  locale?: string,
): string[] =>
  [...new Set(slugs)]
    .filter(slug => slug !== "")
    .map(slug => contentPublicSlugTag(contentTypeId, slug, locale));

/**
 * The exact tags one mutation should invalidate - and no others.
 *
 * Nothing global is ever returned, and one content type's mutation never
 * touches another's tags. A row that was private before and is private after
 * touches nothing at all: creating a draft, or editing one, changes no public
 * response, so invalidating a public list for it would just throw away a warm
 * cache for free. The same rule applies per locale, which is what keeps a Polish
 * publish from expiring every English page.
 *
 * Pure, so the whole matrix is a table test rather than a mocking exercise.
 */
export const contentInvalidationTags = ({
  contentTypeId,
  id,
  isPublic,
  locales,
  slugs,
  wasPublic,
}: ContentInvalidationInput): string[] => {
  if (locales !== undefined) {
    return locales
      .filter(entry => entry.wasPublic || entry.isPublic)
      .flatMap(entry => [
        contentPublicListTag(contentTypeId, entry.locale),
        contentPublicItemTag(contentTypeId, id, entry.locale),
        ...slugTags(contentTypeId, entry.slugs, entry.locale),
      ]);
  }

  if (!wasPublic && !isPublic) return [];

  return [
    contentPublicListTag(contentTypeId),
    contentPublicItemTag(contentTypeId, id),
    ...slugTags(contentTypeId, slugs),
  ];
};

/**
 * What one locale looks like around a mutation, as the fan-out reads it.
 *
 * `hasOwnTranslation` is the one that decides fan-out, and it is deliberately
 * separate from `isPublic`: a locale served by the default translation is public
 * *and* has no translation of its own, and it is exactly that combination which
 * makes it a downstream consumer of the default locale's cache.
 */
export interface ContentLocaleState {
  /** Whether this locale is served by a translation of its own. */
  hasOwnTranslation: boolean;
  /** Reachable in this locale after the mutation, fallback included. */
  isPublic: boolean;
  locale: string;
  /** The slug it answered to before, when the mutation moved it. */
  previousSlug?: string;
  /** The slug this locale answers to now, or `""` when it answers to none. */
  slug: string;
  /** Reachable in this locale before the mutation, fallback included. */
  wasPublic: boolean;
}

/**
 * Which locales one mutation actually reaches.
 *
 * Two rules, and both come straight from what a public response is made of:
 *
 * 1. **A shared field is in every language's response.** So is the base row's
 *    publication state, which gates all of them. A change to either reaches every
 *    locale, and pretending otherwise would leave a withdrawn record readable in
 *    every language but the one it was withdrawn from.
 * 2. **A translation reaches its own locale** - and, when the content type falls
 *    back to the default *and the translation that moved is the default one*, every
 *    locale that has no translation of its own. Those are precisely the locales
 *    whose pages were built from the row that just changed.
 *
 * A translation in a non-default locale reaches nothing else, whatever the
 * fallback setting: nothing falls back to it.
 *
 * Pure, and separate from {@link contentInvalidationTags}, because "which locales"
 * and "which tags" are two rules that fail in different ways - and the first one
 * is the one worth a table test.
 */
export const contentLocaleInvalidations = ({
  changed,
  defaultLocale,
  fallback,
  locale,
  states,
}: {
  changed: "shared" | "translation";
  defaultLocale: string;
  fallback: ContentLocalizationFallback;
  /** The locale that moved. Required for `"translation"`, ignored otherwise. */
  locale?: string;
  states: readonly ContentLocaleState[];
}): ContentLocaleInvalidation[] => {
  const reaches = (state: ContentLocaleState): boolean => {
    if (changed === "shared") return true;
    if (locale === undefined) return false;
    if (contentLocalesMatch(state.locale, locale)) return true;

    return (
      fallback === "default" &&
      contentLocalesMatch(locale, defaultLocale) &&
      !state.hasOwnTranslation
    );
  };

  return states.filter(reaches).map(state => ({
    isPublic: state.isPublic,
    locale: state.locale,
    slugs: [state.previousSlug ?? "", state.slug],
    wasPublic: state.wasPublic,
  }));
};

/**
 * One locale as it stands right now, without the "before" half.
 *
 * What `contentPublicLocaleStates` reads out of the database, and what a caller
 * takes twice - once on each side of a mutation. Client-safe, because the AdminCP
 * Server Action holds a pair of these and diffs them without ever touching
 * Drizzle.
 */
export type ContentPublicLocaleState = Omit<
  ContentLocaleState,
  "previousSlug" | "wasPublic"
>;

/**
 * Folds a before-and-after pair of locale snapshots into invalidation states.
 *
 * Pure, and separate from the reads, so the "what moved" arithmetic is a table
 * test rather than a database fixture. A locale present on one side only is still
 * reported: that is exactly a language that gained or lost its public page.
 */
export const diffContentPublicLocaleStates = (
  before: readonly ContentPublicLocaleState[],
  after: readonly ContentPublicLocaleState[],
): ContentLocaleState[] => {
  const previous = new Map(
    before.map(state => [normalizeContentLocale(state.locale), state]),
  );
  const current = new Map(
    after.map(state => [normalizeContentLocale(state.locale), state]),
  );

  return [...new Set([...previous.keys(), ...current.keys()])].map(key => {
    const was = previous.get(key);
    const is = current.get(key);

    return {
      hasOwnTranslation: is?.hasOwnTranslation ?? false,
      isPublic: is?.isPublic ?? false,
      locale: (is ?? was)?.locale ?? key,
      // Both slugs, so a translation that moved its URL stops answering to the
      // old one and starts answering to the new one.
      previousSlug: was?.slug ?? "",
      slug: is?.slug ?? "",
      wasPublic: was?.isPublic ?? false,
    };
  });
};

/**
 * How hard a localized mutation should expire the tags it touched.
 *
 * The locale-aware half of the same rule the base row follows:
 * stale-while-revalidate is safe only when *every* locale this mutation reached
 * was public before, is public after, and still answers to the same URL. Anything
 * else removed public reachability somewhere, and a withdrawn page must not be
 * served even once more - so one locale losing its page makes the whole
 * invalidation immediate rather than only its own.
 */
export const contentLocaleInvalidationMode = (
  locales: readonly ContentLocaleInvalidation[],
): ContentInvalidationMode => {
  const unchanged = locales.every(entry => {
    if (entry.wasPublic !== entry.isPublic) return false;
    if (!entry.isPublic) return true;

    return new Set(entry.slugs.filter(slug => slug !== "")).size <= 1;
  });

  return unchanged ? "stale-while-revalidate" : "immediate";
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

/**
 * Whether one *translation* is reachable through the public API right now.
 *
 * Subordination, in JavaScript: **the base row and the translation must both be
 * published**. It is the same rule `contentPublicCondition` enforces in SQL, and
 * it is stated as an `&&` of the existing predicate rather than as a second set of
 * clauses so the two cannot drift into disagreeing about what "published" means.
 */
export const isContentTranslationPubliclyVisible = ({
  base,
  translation,
}: {
  base: {
    publishedAt: Date | null | string | undefined;
    status: string | undefined;
  };
  translation: {
    publishedAt: Date | null | string | undefined;
    status: string | undefined;
  };
}): boolean =>
  isContentPubliclyVisible(base) && isContentPubliclyVisible(translation);
