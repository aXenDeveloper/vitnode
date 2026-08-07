// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testLocalizedSearchPageContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { contentSearchUrl } from "../search";
import {
  contentSearchDocument,
  contentTranslationSearchDocument,
} from "./search-document";

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
    { pluginId: "@vitnode/example" },
  );

describe("contentSearchUrl on a localized content type", () => {
  it("substitutes the language as well as the slug", () => {
    expect(
      contentSearchUrl(testLocalizedSearchPageContentType, "witaj", "pl"),
    ).toBe("/pl/pages/witaj");
  });

  it("refuses to build one without a language", () => {
    // One document per language means one URL per language. A link to the wrong
    // language is worse than no link.
    expect(
      contentSearchUrl(testLocalizedSearchPageContentType, "witaj"),
    ).toBeNull();
  });

  it("encodes both, so neither can escape its segment", () => {
    expect(
      contentSearchUrl(testLocalizedSearchPageContentType, "a/b", "pt-BR"),
    ).toBe("/pt-BR/pages/a%2Fb");
  });

  it("ignores a language on a content type that has none", () => {
    expect(contentSearchUrl(testSearchablePostContentType, "hello", "pl")).toBe(
      "/searchable/hello",
    );
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

  it("refuses a draft translation of a published record", () => {
    expect(
      document({ translation: { publishedAt: null, status: "draft" } }),
    ).toBeNull();
  });

  it("refuses a published translation of a draft record", () => {
    // Subordination: nothing is public in any language while the record is a
    // draft, so nothing is indexed either.
    expect(
      document({ base: { publishedAt: null, status: "draft" } }),
    ).toBeNull();
  });

  it("refuses a future publication date on either half", () => {
    const future = new Date(Date.now() + 60_000);

    expect(document({ base: { publishedAt: future } })).toBeNull();
    expect(document({ translation: { publishedAt: future } })).toBeNull();
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
        {},
      ),
    ).toBeNull();
  });
});

describe("contentSearchDocument locale", () => {
  it("leaves `languageCode` off a content type with no languages", () => {
    // `""` is the language-agnostic value that matches every locale, and it is
    // what every document written before Stage 5D already carries.
    const built = contentSearchDocument(testSearchablePostContentType, {
      createdAt: PAST,
      excerpt: "Prose",
      id: 1,
      publishedAt: PAST,
      slug: "hello",
      status: "published",
      title: "Hello",
      updatedAt: PAST,
    });

    expect(built).not.toBeNull();
    expect(built).not.toHaveProperty("languageCode");
  });
});
