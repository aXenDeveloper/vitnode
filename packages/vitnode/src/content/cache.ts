import type { ContentLocalizationFallback } from "./types";

import { CONTENT_CACHE_TAG_MAX_LENGTH } from "./const";
import { clampWithFingerprint } from "./hash";
import { contentLocalesMatch, normalizeContentLocale } from "./locale";

const tag = (...parts: (number | string)[]): string =>
  clampWithFingerprint(
    ["content", ...parts.map(String)].join(":"),
    CONTENT_CACHE_TAG_MAX_LENGTH,
  );

const localeParts = (locale: string | undefined): string[] => {
  if (locale === undefined) return [];

  const normalized = normalizeContentLocale(locale);

  return normalized === "" ? [] : [normalized];
};

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

export const contentPublicSlugTag = (
  contentTypeId: string,
  slug: string,
  locale?: string,
): string => tag(contentTypeId, "slug", ...localeParts(locale), slug);

export const contentDeliveryTag = (
  contentTypeId: string,
  id: number,
  locale?: string,
): string => tag(contentTypeId, "delivery", ...localeParts(locale), id);

export const contentDeliveryRedirectTag = (
  contentTypeId: string,
  slug: string,
  locale?: string,
): string => tag(contentTypeId, "redirect", ...localeParts(locale), slug);

export const contentDeliverySitemapTag = (
  contentTypeId: string,
  locale?: string,
): string => tag(contentTypeId, "sitemap", ...localeParts(locale));

export type ContentInvalidationMode = "immediate" | "stale-while-revalidate";

export interface ContentLocaleInvalidation {
  isPublic: boolean;
  locale: string;
  /** Every slug this locale answered to across the mutation. */
  slugs: readonly string[];
  wasPublic: boolean;
}

export interface ContentDeliveryInvalidation {
  /** What this mutation did to the sitemap. See {@link ContentSitemapChange}. */
  sitemap: ContentSitemapChange;
}

export interface ContentSitemapChange {
  contentChanged: boolean;
  indexChanged: boolean;
}

export interface ContentInvalidationInput {
  contentTypeId: string;
  /** Delivery tags, for a content type with `delivery: { enabled: true }`. */
  delivery?: ContentDeliveryInvalidation;
  id: number;
  /** Whether the row is publicly reachable *after* the mutation. */
  isPublic: boolean;

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

export const contentInvalidationTags = ({
  contentTypeId,
  delivery,
  id,
  isPublic,
  locales,
  slugs,
  wasPublic,
}: ContentInvalidationInput): string[] => {
  if (locales !== undefined) {
    const reached = locales.filter(entry => entry.wasPublic || entry.isPublic);

    return [
      ...reached.flatMap(entry => [
        contentPublicListTag(contentTypeId, entry.locale),
        contentPublicItemTag(contentTypeId, id, entry.locale),
        ...slugTags(contentTypeId, entry.slugs, entry.locale),
      ]),
      ...deliveryTags({
        contentTypeId,
        delivery,
        id,
        locales: reached,
      }),
    ];
  }

  if (!wasPublic && !isPublic) return [];

  return [
    contentPublicListTag(contentTypeId),
    contentPublicItemTag(contentTypeId, id),
    ...slugTags(contentTypeId, slugs),
    ...deliveryTags({
      contentTypeId,
      delivery,
      id,
      locales: [{ isPublic, locale: undefined, slugs, wasPublic }],
    }),
  ];
};

const deliveryTags = ({
  contentTypeId,
  delivery,
  id,
  locales,
}: {
  contentTypeId: string;
  delivery: ContentDeliveryInvalidation | undefined;
  id: number;
  locales: readonly {
    isPublic: boolean;
    locale: string | undefined;
    slugs: readonly string[];
    wasPublic: boolean;
  }[];
}): string[] => {
  if (delivery === undefined) return [];

  const tags = locales.flatMap(entry => [
    contentDeliveryTag(contentTypeId, id, entry.locale),
    ...[...new Set(entry.slugs)]
      .filter(slug => slug !== "")
      .map(slug =>
        contentDeliveryRedirectTag(contentTypeId, slug, entry.locale),
      ),
    // The sitemap *file* this locale is listed in. For a content type that is not
    // localized `entry.locale` is `undefined`, so this is the locale-less tag - which
    // is that content type's only sitemap file rather than an index of files.
    ...(delivery.sitemap.contentChanged
      ? [contentDeliverySitemapTag(contentTypeId, entry.locale)]
      : []),
  ]);

  // The locale-less tag on its own means the *index* of a localized content type's
  // per-locale files, so it is expired only when the set of files or their count
  // moved - never for a title edit, which rewrites bytes inside one existing file.
  // De-duplicated, because a content type that is not localized produces only this
  // form and the line above already emitted it.
  return [
    ...new Set(
      delivery.sitemap.indexChanged
        ? [...tags, contentDeliverySitemapTag(contentTypeId)]
        : tags,
    ),
  ];
};

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

export type ContentPublicLocaleState = Omit<
  ContentLocaleState,
  "previousSlug" | "wasPublic"
>;

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
