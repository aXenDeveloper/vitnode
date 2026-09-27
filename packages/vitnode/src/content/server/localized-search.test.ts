// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testContentLocaleRouting,
  testLocalizedSearchPageContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { contentSearchUrl } from "../search";
import {
  contentSearchDocument,
  contentTranslationSearchDocument,
} from "./search-document";

const routing = testContentLocaleRouting();

const PAST = new Date("2020-01-01T00:00:00.000Z");
const LATER = new Date("2020-06-01T00:00:00.000Z");

const base = {
  createdAt: PAST,
  featured: true,
  id: 7,
  publishedAt: PAST,
  status: "published",
  updatedAt: PAST,
};

const translation = {
  body: "Treść po polsku",
  publishedAt: LATER,
  slug: "witaj",
  status: "published",
  title: "Witaj",
  updatedAt: LATER,
};

const document = (
  overrides: {
    base?: Record<string, unknown>;
    locale?: string;
    translation?: Record<string, unknown>;
  } = {},
) =>
  contentTranslationSearchDocument(
    testLocalizedSearchPageContentType,
    {
      base: { ...base, ...overrides.base },
      locale: overrides.locale ?? "pl",
      translation: { ...translation, ...overrides.translation },
    },
    { pluginId: "@vitnode/example", routing },
  );

describe("contentSearchUrl on a localized content type", () => {
  const url = (
    slug: string,
    locale?: string,
    options: Partial<Parameters<typeof contentSearchUrl>[0]> = {},
  ) =>
    contentSearchUrl({
      definition: testLocalizedSearchPageContentType,
      locale,
      routing,
      slug,
      ...options,
    });

  it("lets the locale routing place the language", () => {
    expect(url("hello", "en")).toBe("/pages/hello");
    expect(url("witaj", "pl")).toBe("/pl/pages/witaj");
  });

  it("treats a legacy /{locale}/ template exactly like the new form", () => {
    expect(testLocalizedSearchPageContentType.search.pathTemplate).toBe(
      "/pages/{slug}",
    );
    expect(
      url("hello", "en", {
        routing: testContentLocaleRouting({ localePrefix: "always" }),
      }),
    ).toBe("/en/pages/hello");
  });

  it("translates the route and links a language's own domain absolutely", () => {
    const routePaths = { pl: { "/pages/:slug": "/strony/:slug" } };

    expect(
      url("witaj", "pl", { routing: testContentLocaleRouting({ routePaths }) }),
    ).toBe("/pl/strony/witaj");
    expect(
      url("witaj", "pl", {
        routing: testContentLocaleRouting({
          domains: [
            { defaultLocale: "en", origin: "https://vitnode.com" },
            { defaultLocale: "pl", origin: "https://vitnode.pl" },
          ],
          routePaths,
        }),
      }),
    ).toBe("https://vitnode.pl/strony/witaj");
  });

  it("refuses to build one without a language", () => {
    // One document per language means one URL per language. A link to the wrong
    // language is worse than no link.
    expect(url("witaj")).toBeNull();
  });

  it("encodes the slug, so it cannot escape its segment", () => {
    expect(url("a/b", "pl")).toBe("/pl/pages/a%2Fb");
  });

  it("ignores a language on a content type that has none", () => {
    expect(
      contentSearchUrl({
        definition: testSearchablePostContentType,
        locale: "pl",
        routing,
        slug: "hello",
      }),
    ).toBe("/searchable/hello");
  });
});

describe("contentTranslationSearchDocument", () => {
  it("builds one document from both halves of the page", () => {
    expect(document()).toMatchObject({
      itemId: 7,
      itemType: "test.localized-search-page",
      languageCode: "pl",
      title: "Witaj",
      url: "/pl/pages/witaj",
    });
  });

  it("indexes the localized prose, not the base row's", () => {
    expect(document()?.content).toContain("Treść po polsku");
  });

  it("dates the document by this language's publication", () => {
    // A translation published months later belongs where it appeared in "newest",
    // not where its record did.
    expect(document()?.createdAt).toEqual(LATER);
  });

  it("keeps a draft translation of a published record private", () => {
    const result = document({
      translation: { publishedAt: null, status: "draft" },
    });

    expect(result?.isPublic).toBe(false);
    expect(result).not.toHaveProperty("url");
  });

  it("keeps a published translation of a draft record private", () => {
    // Subordination: nothing is public in any language while the record is a
    // draft.
    expect(
      document({ base: { publishedAt: null, status: "draft" } })?.isPublic,
    ).toBe(false);
  });

  it("keeps a future publication date on either half private", () => {
    const future = new Date(Date.now() + 60_000);

    expect(document({ base: { publishedAt: future } })?.isPublic).toBe(false);
    expect(document({ translation: { publishedAt: future } })?.isPublic).toBe(
      false,
    );
  });

  it("refuses a translation with no usable title", () => {
    // Published, and still not indexable - which is why the sync deletes its
    // document rather than leaving whatever it held last time.
    expect(document({ translation: { title: "   " } })).toBeNull();
  });

  it("carries the shared fields too", () => {
    // `featured` lives on the base row, and the document is the page - so a
    // filterable shared value is part of what was indexed.
    expect(document()).not.toBeNull();
  });

  it("returns nothing for a content type that is not localized", () => {
    expect(
      contentTranslationSearchDocument(
        testSearchablePostContentType,
        { base, locale: "pl", translation },
        { routing },
      ),
    ).toBeNull();
  });
});

describe("contentSearchDocument locale", () => {
  it("leaves `languageCode` off a content type with no languages", () => {
    // `""` is the language-agnostic value that matches every locale, and it is
    // what every document written before Stage 5D already carries.
    const built = contentSearchDocument(
      testSearchablePostContentType,
      {
        createdAt: PAST,
        excerpt: "Prose",
        id: 1,
        publishedAt: PAST,
        slug: "hello",
        status: "published",
        title: "Hello",
        updatedAt: PAST,
      },
      { routing },
    );

    expect(built).not.toBeNull();
    expect(built).not.toHaveProperty("languageCode");
  });
});
