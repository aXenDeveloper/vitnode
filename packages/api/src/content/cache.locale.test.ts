import { describe, expect, it } from "vitest";

import type {
  ContentLocaleInvalidation,
  ContentLocaleState,
  ContentPublicLocaleState,
} from "./cache";

import {
  contentInvalidationTags,
  contentLocaleInvalidationMode,
  contentLocaleInvalidations,
  contentPublicItemTag,
  contentPublicListTag,
  contentPublicSlugTag,
  diffContentPublicLocaleStates,
  isContentTranslationPubliclyVisible,
} from "./cache";

const ID = "example.article";

describe("locale-aware cache tags", () => {
  it("leaves a locale-less tag byte-identical to what it always was", () => {
    // Every Stage 1-4 content type has to keep the tags it already produced, or
    // one deploy invalidates nothing anybody was holding.
    expect(contentPublicListTag(ID)).toBe("content:example.article:list");
    expect(contentPublicItemTag(ID, 7)).toBe("content:example.article:item:7");
    expect(contentPublicSlugTag(ID, "hello")).toBe(
      "content:example.article:slug:hello",
    );
  });

  it("puts the locale after the scope, so the two forms cannot collide", () => {
    expect(contentPublicListTag(ID, "pl")).toBe(
      "content:example.article:list:pl",
    );
    expect(contentPublicItemTag(ID, 7, "pl")).toBe(
      "content:example.article:item:pl:7",
    );
    expect(contentPublicSlugTag(ID, "hello", "pl")).toBe(
      "content:example.article:slug:pl:hello",
    );
  });

  it("normalizes the locale, so `PL` and `pl` expire together", () => {
    expect(contentPublicListTag(ID, " PL ")).toBe(
      contentPublicListTag(ID, "pl"),
    );
  });

  it("treats an empty locale as absent rather than as a segment", () => {
    expect(contentPublicListTag(ID, "")).toBe(contentPublicListTag(ID));
  });

  it("keeps two languages on the same slug apart", () => {
    // `/en/about` and `/pl/about` are different pages that happen to share a
    // slug. One tag for both would make one language's edit expire the other's.
    expect(contentPublicSlugTag(ID, "about", "en")).not.toBe(
      contentPublicSlugTag(ID, "about", "pl"),
    );
  });
});

describe("contentInvalidationTags with locales", () => {
  const base = { contentTypeId: ID, id: 7, isPublic: true, wasPublic: true };

  it("emits per-locale tags and no locale-less ones", () => {
    // A localized content type has no locale-less public URL, so a tag without a
    // locale segment would name a page that does not exist.
    expect(
      contentInvalidationTags({
        ...base,
        locales: [
          { isPublic: true, locale: "pl", slugs: ["witaj"], wasPublic: true },
        ],
        slugs: ["hello"],
      }),
    ).toEqual([
      "content:example.article:list:pl",
      "content:example.article:item:pl:7",
      "content:example.article:slug:pl:witaj",
    ]);
  });

  it("skips a locale that was private and stayed private", () => {
    expect(
      contentInvalidationTags({
        ...base,
        locales: [
          { isPublic: false, locale: "de", slugs: [""], wasPublic: false },
          { isPublic: true, locale: "pl", slugs: ["witaj"], wasPublic: false },
        ],
        slugs: [],
      }),
    ).not.toContain("content:example.article:list:de");
  });

  it("expires both URLs when a locale moved its slug", () => {
    const tags = contentInvalidationTags({
      ...base,
      locales: [
        {
          isPublic: true,
          locale: "pl",
          slugs: ["stary", "nowy"],
          wasPublic: true,
        },
      ],
      slugs: [],
    });

    expect(tags).toContain("content:example.article:slug:pl:stary");
    expect(tags).toContain("content:example.article:slug:pl:nowy");
  });

  it("returns nothing when no locale was or is public", () => {
    expect(
      contentInvalidationTags({
        ...base,
        isPublic: false,
        locales: [
          { isPublic: false, locale: "pl", slugs: [""], wasPublic: false },
        ],
        slugs: [],
        wasPublic: false,
      }),
    ).toEqual([]);
  });

  it("ignores the flat fields entirely when locales are present", () => {
    // The flat pair describes a record; a localized record's pages are per
    // language, and mixing the two would expire a tag nothing is stored under.
    expect(
      contentInvalidationTags({
        ...base,
        locales: [],
        slugs: ["hello"],
      }),
    ).toEqual([]);
  });
});

describe("contentLocaleInvalidations", () => {
  const states: ContentLocaleState[] = [
    {
      hasOwnTranslation: true,
      isPublic: true,
      locale: "en",
      previousSlug: "hello",
      slug: "hello",
      wasPublic: true,
    },
    {
      hasOwnTranslation: true,
      isPublic: true,
      locale: "pl",
      previousSlug: "witaj",
      slug: "witaj",
      wasPublic: true,
    },
    {
      hasOwnTranslation: false,
      isPublic: true,
      locale: "de",
      previousSlug: "hello",
      slug: "hello",
      wasPublic: true,
    },
  ];

  const locales = (
    input: Partial<Parameters<typeof contentLocaleInvalidations>[0]>,
  ) =>
    contentLocaleInvalidations({
      changed: "shared",
      defaultLocale: "en",
      fallback: "default",
      states,
      ...input,
    }).map(entry => entry.locale);

  it("reaches every locale for a shared change", () => {
    // A shared field is in every language's response, and the base row's
    // publication state gates all of them.
    expect(locales({ changed: "shared" })).toEqual(["en", "pl", "de"]);
  });

  it("reaches only its own locale for a non-default translation", () => {
    // Nothing falls back to Polish, whatever the fallback setting is.
    expect(locales({ changed: "translation", locale: "pl" })).toEqual(["pl"]);
  });

  it("reaches the fallback consumers when the default translation moves", () => {
    // `de` has no translation of its own, so its page was built from the row
    // that just changed. `pl` has one and is untouched.
    expect(locales({ changed: "translation", locale: "en" })).toEqual([
      "en",
      "de",
    ]);
  });

  it("reaches only the default locale when the fallback is `none`", () => {
    expect(
      locales({ changed: "translation", fallback: "none", locale: "en" }),
    ).toEqual(["en"]);
  });

  it("matches the locale case-insensitively", () => {
    expect(locales({ changed: "translation", locale: "PL" })).toEqual(["pl"]);
  });

  it("reaches nothing when a translation change names no locale", () => {
    expect(locales({ changed: "translation" })).toEqual([]);
  });

  it("carries both slugs, so a moved URL stops resolving", () => {
    const [entry] = contentLocaleInvalidations({
      changed: "translation",
      defaultLocale: "en",
      fallback: "none",
      locale: "pl",
      states: [
        {
          hasOwnTranslation: true,
          isPublic: true,
          locale: "pl",
          previousSlug: "stary",
          slug: "nowy",
          wasPublic: true,
        },
      ],
    });

    expect(entry.slugs).toEqual(["stary", "nowy"]);
  });
});

describe("contentLocaleInvalidationMode", () => {
  const entry = (
    over: Partial<ContentLocaleInvalidation> = {},
  ): ContentLocaleInvalidation => ({
    isPublic: true,
    locale: "pl",
    slugs: ["witaj", "witaj"],
    wasPublic: true,
    ...over,
  });

  it("keeps the cache warm when nothing was removed", () => {
    expect(contentLocaleInvalidationMode([entry()])).toBe(
      "stale-while-revalidate",
    );
  });

  it("expires immediately when one locale lost its page", () => {
    // One withdrawn page makes the whole invalidation immediate: serving it once
    // more is exactly the failure being prevented.
    expect(
      contentLocaleInvalidationMode([
        entry(),
        entry({ isPublic: false, locale: "de" }),
      ]),
    ).toBe("immediate");
  });

  it("expires immediately when a URL moved", () => {
    expect(
      contentLocaleInvalidationMode([entry({ slugs: ["stary", "nowy"] })]),
    ).toBe("immediate");
  });

  it("keeps the cache warm for a locale that was never public", () => {
    expect(
      contentLocaleInvalidationMode([
        entry({ isPublic: false, slugs: [""], wasPublic: false }),
      ]),
    ).toBe("stale-while-revalidate");
  });
});

describe("diffContentPublicLocaleStates", () => {
  const state = (
    over: Partial<ContentPublicLocaleState>,
  ): ContentPublicLocaleState => ({
    hasOwnTranslation: true,
    isPublic: true,
    locale: "pl",
    slug: "witaj",
    ...over,
  });

  it("pairs the two sides by locale", () => {
    expect(
      diffContentPublicLocaleStates(
        [state({ slug: "stary" })],
        [state({ slug: "nowy" })],
      ),
    ).toEqual([
      {
        hasOwnTranslation: true,
        isPublic: true,
        locale: "pl",
        previousSlug: "stary",
        slug: "nowy",
        wasPublic: true,
      },
    ]);
  });

  it("reports a locale that only existed before", () => {
    const [entry] = diffContentPublicLocaleStates([state({})], []);

    expect(entry).toMatchObject({ isPublic: false, wasPublic: true });
  });

  it("reports a locale that only exists after", () => {
    const [entry] = diffContentPublicLocaleStates([], [state({})]);

    expect(entry).toMatchObject({ isPublic: true, wasPublic: false });
  });

  it("pairs two spellings of the same locale", () => {
    expect(
      diffContentPublicLocaleStates(
        [state({ locale: "PL" })],
        [state({ locale: "pl" })],
      ),
    ).toHaveLength(1);
  });
});

describe("isContentTranslationPubliclyVisible", () => {
  const published = {
    publishedAt: new Date("2020-01-01T00:00:00.000Z"),
    status: "published",
  };
  const draft = { publishedAt: null, status: "draft" };

  it("needs both halves published", () => {
    expect(
      isContentTranslationPubliclyVisible({
        base: published,
        translation: published,
      }),
    ).toBe(true);
  });

  it("refuses a published translation of a draft record", () => {
    expect(
      isContentTranslationPubliclyVisible({
        base: draft,
        translation: published,
      }),
    ).toBe(false);
  });

  it("refuses a draft translation of a published record", () => {
    expect(
      isContentTranslationPubliclyVisible({
        base: published,
        translation: draft,
      }),
    ).toBe(false);
  });

  it("refuses a future publication date on either half", () => {
    const future = {
      publishedAt: new Date(Date.now() + 60_000),
      status: "published",
    };

    expect(
      isContentTranslationPubliclyVisible({
        base: published,
        translation: future,
      }),
    ).toBe(false);
  });
});
