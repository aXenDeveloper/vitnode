// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentPublicLocaleState } from "@/content/cache";

import {
  testDeliveredLocalizedContentType,
  testLocalizedPageContentType,
} from "@/tests/content-fixtures";

const cacheTags: string[] = [];

// The real `revalidate.server` runs, so what is asserted is the tag list
// `contentInvalidationTags` actually produces - mocking the layer in between would
// test the mock.
vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: (tag: string) => {
    cacheTags.push(tag);
  },
  updateTag: (tag: string) => {
    cacheTags.push(tag);
  },
}));

vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async () => await Promise.resolve({ status: 500 }),
}));

const { invalidateContentLocales } = await import("./public-locale-cache");

/**
 * The localized half of delivery sitemap invalidation.
 *
 * A localized sitemap entry's `lastModified` is `max(base.updatedAt,
 * translation.updatedAt)`, so a real edit to a **published translation** changes that
 * locale's sitemap file even when its URL does not move - and a shared field edit
 * changes every published locale's file, because the base timestamp is in all of them.
 *
 * The distinction these tests pin down is which locale, and whether the *index* moved:
 * a title edit rewrites bytes inside one existing file and changes neither which files
 * exist nor how many.
 */
const DELIVERED = "test.delivered-localized";
const sitemapTag = (locale?: string) =>
  locale === undefined
    ? `content:${DELIVERED}:sitemap`
    : `content:${DELIVERED}:sitemap:${locale}`;

/** A locale with its own published translation. */
const own = (locale: string, slug: string): ContentPublicLocaleState => ({
  hasOwnTranslation: true,
  isPublic: true,
  locale,
  slug,
});

/** A locale served the default translation, with none of its own. */
const fallbackOnly = (
  locale: string,
  slug: string,
): ContentPublicLocaleState => ({
  hasOwnTranslation: false,
  isPublic: true,
  locale,
  slug,
});

beforeEach(() => {
  cacheTags.length = 0;
});

describe("a translation update", () => {
  it("expires only that locale's sitemap file", () => {
    const states = [own("en", "hello"), own("pl", "witaj")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "translation", locale: "pl" },
    );

    expect(cacheTags).toContain(sitemapTag("pl"));
    // English did not move, so its file is still byte-correct.
    expect(cacheTags).not.toContain(sitemapTag("en"));
  });

  it("leaves the sitemap index alone", () => {
    // A title edit rewrites a `<lastmod>` inside one file. It does not change which
    // files exist, so the index that enumerates them is untouched.
    const states = [own("en", "hello"), own("pl", "witaj")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "translation", locale: "pl" },
    );

    expect(cacheTags).not.toContain(sitemapTag());
  });
});

describe("a shared update", () => {
  it("expires every published locale's sitemap file", () => {
    // The base row's `updatedAt` is part of `max(base, translation)` for every
    // language, so a shared edit changes what each of their files serializes.
    const states = [own("en", "hello"), own("pl", "witaj")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "shared" },
    );

    expect(cacheTags).toContain(sitemapTag("en"));
    expect(cacheTags).toContain(sitemapTag("pl"));
  });

  it("still leaves the index alone", () => {
    const states = [own("en", "hello"), own("pl", "witaj")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "shared" },
    );

    expect(cacheTags).not.toContain(sitemapTag());
  });

  it("skips a locale that is not public", () => {
    const states = [
      own("en", "hello"),
      { hasOwnTranslation: true, isPublic: false, locale: "pl", slug: "witaj" },
    ];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "shared" },
    );

    expect(cacheTags).toContain(sitemapTag("en"));
    // A draft translation is in no sitemap, so nothing about it went stale.
    expect(cacheTags).not.toContain(sitemapTag("pl"));
  });
});

describe("a default-locale update with a fallback consumer", () => {
  it("follows the Stage 5 fan-out", () => {
    // `fallback: "default"` makes Polish's *public page* the English translation, so
    // Stage 5 reaches Polish - and this reuses that fan-out rather than inventing a
    // second locale-propagation rule.
    //
    // Polish contributes **no sitemap URL**, because a sitemap never lists a fallback
    // (the delivery Postgres suite asserts that directly), so expiring its file is
    // conservative rather than necessary: a cache miss, never a stale document.
    const states = [own("en", "hello"), fallbackOnly("pl", "hello")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "translation", locale: "en" },
    );

    expect(cacheTags).toContain(sitemapTag("en"));
    expect(cacheTags).toContain(sitemapTag("pl"));
  });

  it("does not reach a locale with its own translation", () => {
    // Nothing falls back to a language that has its own copy, so a default-locale
    // edit leaves it entirely alone.
    const states = [own("en", "hello"), own("pl", "witaj")];

    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      states,
      states,
      { changed: "translation", locale: "en" },
    );

    expect(cacheTags).toContain(sitemapTag("en"));
    expect(cacheTags).not.toContain(sitemapTag("pl"));
  });
});

describe("membership changes", () => {
  it("expires the file and the index when a translation is published", () => {
    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      [
        own("en", "hello"),
        {
          hasOwnTranslation: true,
          isPublic: false,
          locale: "pl",
          slug: "witaj",
        },
      ],
      [own("en", "hello"), own("pl", "witaj")],
      { changed: "translation", locale: "pl" },
    );

    expect(cacheTags).toContain(sitemapTag("pl"));
    // A language gained a URL, so how many the index counts moved.
    expect(cacheTags).toContain(sitemapTag());
  });

  it("expires the file and the index when a translation is deleted", () => {
    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      [own("en", "hello"), own("pl", "witaj")],
      // Absent from the "after" side entirely: the translation is gone.
      [own("en", "hello")],
      { changed: "translation", locale: "pl" },
    );

    expect(cacheTags).toContain(sitemapTag("pl"));
    expect(cacheTags).toContain(sitemapTag());
  });

  it("expires every locale's file and the index when the record is unpublished", () => {
    invalidateContentLocales(
      testDeliveredLocalizedContentType,
      7,
      [own("en", "hello"), own("pl", "witaj")],
      [
        {
          hasOwnTranslation: true,
          isPublic: false,
          locale: "en",
          slug: "hello",
        },
        {
          hasOwnTranslation: true,
          isPublic: false,
          locale: "pl",
          slug: "witaj",
        },
      ],
      { changed: "shared" },
    );

    expect(cacheTags).toContain(sitemapTag("en"));
    expect(cacheTags).toContain(sitemapTag("pl"));
    expect(cacheTags).toContain(sitemapTag());
  });
});

describe("a localized content type without delivery", () => {
  it("produces exactly the Stage 1-7 tag list", () => {
    const states = [
      { hasOwnTranslation: true, isPublic: true, locale: "en", slug: "hello" },
      { hasOwnTranslation: true, isPublic: true, locale: "pl", slug: "witaj" },
    ];

    invalidateContentLocales(testLocalizedPageContentType, 7, states, states, {
      changed: "translation",
      locale: "pl",
    });

    const id = testLocalizedPageContentType.id;
    expect(cacheTags).toStrictEqual([
      `content:${id}:list:pl`,
      `content:${id}:item:pl:7`,
      `content:${id}:slug:pl:witaj`,
    ]);
  });
});
