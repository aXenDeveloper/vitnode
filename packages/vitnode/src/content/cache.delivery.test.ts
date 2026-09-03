import { describe, expect, it } from "vitest";

import {
  contentDeliveryRedirectTag,
  contentDeliverySitemapTag,
  contentDeliveryTag,
  contentInvalidationTags,
  contentPublicItemTag,
  contentPublicListTag,
  contentPublicSlugTag,
} from "./cache";

const ID = "example.article";

describe("delivery tag builders", () => {
  it("follows the existing namespace, with the locale after the scope", () => {
    expect(contentDeliveryTag(ID, 42)).toBe(
      "content:example.article:delivery:42",
    );
    expect(contentDeliveryTag(ID, 42, "pl")).toBe(
      "content:example.article:delivery:pl:42",
    );

    expect(contentDeliveryRedirectTag(ID, "old-slug")).toBe(
      "content:example.article:redirect:old-slug",
    );
    expect(contentDeliveryRedirectTag(ID, "stary-slug", "pl")).toBe(
      "content:example.article:redirect:pl:stary-slug",
    );

    expect(contentDeliverySitemapTag(ID)).toBe(
      "content:example.article:sitemap",
    );
    expect(contentDeliverySitemapTag(ID, "pl")).toBe(
      "content:example.article:sitemap:pl",
    );
  });

  it("normalizes the locale, so PL and pl expire together", () => {
    for (const locale of ["PL", "pl", " pl "]) {
      expect(contentDeliveryTag(ID, 1, locale)).toBe(
        "content:example.article:delivery:pl:1",
      );
      expect(contentDeliverySitemapTag(ID, locale)).toBe(
        "content:example.article:sitemap:pl",
      );
    }
  });
});

describe("contentInvalidationTags without delivery", () => {
  it("is byte-identical to the Stage 1-7 output for a flat mutation", () => {
    expect(
      contentInvalidationTags({
        contentTypeId: ID,
        id: 42,
        isPublic: true,
        slugs: ["old", "new"],
        wasPublic: true,
      }),
    ).toStrictEqual([
      contentPublicListTag(ID),
      contentPublicItemTag(ID, 42),
      contentPublicSlugTag(ID, "old"),
      contentPublicSlugTag(ID, "new"),
    ]);
  });

  it("is byte-identical for a localized mutation", () => {
    expect(
      contentInvalidationTags({
        contentTypeId: ID,
        id: 7,
        isPublic: true,
        locales: [
          {
            isPublic: true,
            locale: "pl",
            slugs: ["stary", "nowy"],
            wasPublic: true,
          },
        ],
        slugs: [],
        wasPublic: true,
      }),
    ).toStrictEqual([
      contentPublicListTag(ID, "pl"),
      contentPublicItemTag(ID, 7, "pl"),
      contentPublicSlugTag(ID, "stary", "pl"),
      contentPublicSlugTag(ID, "nowy", "pl"),
    ]);
  });

  it("still returns nothing for a draft edited into another draft", () => {
    expect(
      contentInvalidationTags({
        contentTypeId: ID,
        id: 1,
        isPublic: false,
        slugs: ["a", "b"],
        wasPublic: false,
      }),
    ).toStrictEqual([]);
  });
});

describe("contentInvalidationTags with delivery", () => {
  it("adds the delivery metadata tag and one redirect tag per slug", () => {
    expect(
      contentInvalidationTags({
        contentTypeId: ID,
        delivery: { sitemap: { contentChanged: false, indexChanged: false } },
        id: 42,
        isPublic: true,
        slugs: ["old", "new"],
        wasPublic: true,
      }),
    ).toStrictEqual([
      contentPublicListTag(ID),
      contentPublicItemTag(ID, 42),
      contentPublicSlugTag(ID, "old"),
      contentPublicSlugTag(ID, "new"),
      contentDeliveryTag(ID, 42),
      contentDeliveryRedirectTag(ID, "old"),
      contentDeliveryRedirectTag(ID, "new"),
    ]);
  });

  it("expires the sitemap file whenever its bytes moved", () => {
    // A nonlocalized content type's locale-less tag *is* its one sitemap file, so
    // `contentChanged` is what expires it - including for a plain title edit, whose
    // `<lastmod>` moved even though the URL did not.
    const withSitemap = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: true, indexChanged: false } },
      id: 42,
      isPublic: true,
      slugs: ["same"],
      wasPublic: true,
    });

    expect(withSitemap).toContain(contentDeliverySitemapTag(ID));

    const untouched = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: false, indexChanged: false } },
      id: 42,
      isPublic: true,
      slugs: ["new"],
      wasPublic: true,
    });

    expect(untouched).not.toContain(contentDeliverySitemapTag(ID));
  });

  it("emits the sitemap tag once for a nonlocalized content type", () => {
    // `contentChanged` and `indexChanged` name the same tag here, because a
    // nonlocalized content type has one file and no index.
    const tags = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: true, indexChanged: true } },
      id: 42,
      isPublic: true,
      slugs: ["new"],
      wasPublic: false,
    });

    expect(
      tags.filter(tag => tag === contentDeliverySitemapTag(ID)),
    ).toHaveLength(1);
  });

  it("expires each locale's sitemap and the index that lists them", () => {
    const tags = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: true, indexChanged: true } },
      id: 7,
      isPublic: true,
      locales: [
        { isPublic: true, locale: "en", slugs: ["hello"], wasPublic: true },
        { isPublic: true, locale: "pl", slugs: ["witaj"], wasPublic: false },
      ],
      slugs: [],
      wasPublic: true,
    });

    expect(tags).toContain(contentDeliverySitemapTag(ID, "en"));
    expect(tags).toContain(contentDeliverySitemapTag(ID, "pl"));
    // The locale-less one too, because a language gaining a page changes how many
    // files the index lists.
    expect(tags).toContain(contentDeliverySitemapTag(ID));
  });

  it("expires a locale's file without its index on an ordinary edit", () => {
    // The rule §3.6 asks for: a title edit rewrites bytes inside an existing file and
    // changes neither which files exist nor how many.
    const tags = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: true, indexChanged: false } },
      id: 7,
      isPublic: true,
      locales: [
        { isPublic: true, locale: "pl", slugs: ["witaj"], wasPublic: true },
      ],
      slugs: [],
      wasPublic: true,
    });

    expect(tags).toContain(contentDeliverySitemapTag(ID, "pl"));
    expect(tags).not.toContain(contentDeliverySitemapTag(ID));
    expect(tags).not.toContain(contentDeliverySitemapTag(ID, "en"));
  });

  it("keeps one locale's delivery tags out of another's", () => {
    const tags = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: false, indexChanged: false } },
      id: 7,
      isPublic: true,
      locales: [
        {
          isPublic: true,
          locale: "pl",
          slugs: ["stary", "nowy"],
          wasPublic: true,
        },
      ],
      slugs: [],
      wasPublic: true,
    });

    expect(tags).toContain(contentDeliveryTag(ID, 7, "pl"));
    expect(tags).toContain(contentDeliveryRedirectTag(ID, "stary", "pl"));
    expect(tags).not.toContain(contentDeliveryTag(ID, 7, "en"));
    expect(tags).not.toContain(contentDeliveryRedirectTag(ID, "stary", "en"));
  });

  it("touches nothing at all for a draft that stayed a draft", () => {
    // The delivery tags follow the public ones: a mutation that changed no public
    // response should not throw away a warm cache for a feature it did not reach.
    expect(
      contentInvalidationTags({
        contentTypeId: ID,
        delivery: { sitemap: { contentChanged: false, indexChanged: false } },
        id: 1,
        isPublic: false,
        slugs: ["a", "b"],
        wasPublic: false,
      }),
    ).toStrictEqual([]);
  });

  it("drops an empty slug rather than tagging a redirect for it", () => {
    const tags = contentInvalidationTags({
      contentTypeId: ID,
      delivery: { sitemap: { contentChanged: false, indexChanged: false } },
      id: 42,
      isPublic: true,
      slugs: ["", "new"],
      wasPublic: false,
    });

    expect(tags).not.toContain(contentDeliveryRedirectTag(ID, ""));
    expect(tags).toContain(contentDeliveryRedirectTag(ID, "new"));
  });
});
