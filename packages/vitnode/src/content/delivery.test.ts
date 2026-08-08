import { describe, expect, it } from "vitest";

import { defineContentType } from "./define";
import {
  contentDeliveryHreflang,
  contentDeliveryOpenGraph,
  contentDeliveryPath,
  contentDeliveryRobots,
  contentDeliverySeo,
  contentDeliveryUrl,
  contentSitemapDefaults,
  isDeliverableContentType,
  listDeliveryContentTypes,
  parseContentDeliveryPath,
} from "./delivery";
import { field } from "./fields";

/**
 * Stage 8 definition validation and the pure delivery projections.
 *
 * Everything here runs without a database, because everything here is a rule about
 * a *definition* or a pure function over a public row - and the rules are the half
 * of Stage 8 that has to fail loudly at boot rather than quietly at request time.
 */

const base = {
  admin: { label: { plural: "Articles", singular: "Article" } },
  publication: { enabled: true } as const,
  tableName: "delivery_articles",
} as const;

const publicApi = {
  enabled: true,
  fields: ["id", "title", "slug", "excerpt", "publishedAt"],
  path: "articles",
} as const;

const fields = {
  excerpt: field.textarea({ maxLength: 500, nullable: true }),
  hidden: field.boolean({ defaultValue: false }),
  /** A text field the public allowlist deliberately withholds. */
  internalCode: field.text({ nullable: true }),
  slug: field.slug({ source: "title" }),
  title: field.text({ maxLength: 200, required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const articleType = defineContentType({
  ...base,
  id: "delivery.article",
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: { descriptionField: "excerpt", titleField: "title" },
    sitemap: { changeFrequency: "weekly", enabled: true, priority: 0.7 },
  },
  fields,
  publicApi,
});

const plainType = defineContentType({
  ...base,
  id: "delivery.plain",
  fields,
  publicApi,
  tableName: "delivery_plain",
});

describe("delivery definition validation", () => {
  it("defaults to disabled, so a Stage 1-7 content type is unchanged", () => {
    expect(plainType.delivery).toStrictEqual({
      enabled: false,
      hreflang: { xDefault: null },
      redirects: { enabled: false },
      seo: {
        descriptionField: null,
        fallbackDescriptionField: null,
        fallbackTitleField: null,
        noIndexField: null,
        openGraph: null,
        titleField: null,
      },
      sitemap: { changeFrequency: null, enabled: false, priority: null },
      slugScope: "none",
    });
  });

  it("refuses delivery without a public API", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.private",
        // Refused by the types too - see `delivery.test-d.ts`. Cast here because
        // this asserts the *runtime* guard, which a JavaScript caller still reaches.
        delivery: { enabled: true as never },
        fields,
        tableName: "delivery_private",
      }),
    ).toThrow(/delivery needs `publicApi/);
  });

  it("refuses an SEO field that is not publicly exposed", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.private-seo",
        // A text field, so the kind check passes - and absent from
        // `publicApi.fields`, so a `<title>` built from it would publish something
        // the public API deliberately withholds.
        delivery: {
          enabled: true,
          seo: { titleField: "internalCode" as never },
        },
        fields,
        publicApi,
        tableName: "delivery_private_seo",
      }),
    ).toThrow(/not in publicApi.fields/);
  });

  it("refuses an unsupported SEO field kind", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.bad-kind",
        // `excerpt` is a textarea, which is a description and never a title.
        delivery: { enabled: true, seo: { titleField: "excerpt" as never } },
        fields,
        publicApi,
        tableName: "delivery_bad_kind",
      }),
    ).toThrow(/of kind "textarea"/);
  });

  it("refuses an unknown SEO field", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.unknown-seo",
        delivery: { enabled: true, seo: { titleField: "nope" as never } },
        fields,
        publicApi,
        tableName: "delivery_unknown_seo",
      }),
    ).toThrow(/references unknown field "nope"/);
  });

  it("refuses a repeatable leaf as a title", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.repeatable-seo",
        delivery: {
          enabled: true,
          seo: { titleField: "faq.question" as never },
        },
        fields: {
          ...fields,
          faq: field.repeatable({
            fields: { question: field.text({ required: true }) },
          }),
        },
        publicApi: {
          ...publicApi,
          fields: [...publicApi.fields, "faq.question"],
        },
        tableName: "delivery_repeatable_seo",
      }),
    ).toThrow(/many values rather than one/);
  });

  it("accepts a group leaf as a title and a description", () => {
    const withGroup = defineContentType({
      ...base,
      id: "delivery.group-seo",
      delivery: {
        enabled: true,
        seo: {
          descriptionField: "seo.description",
          fallbackTitleField: "title",
          titleField: "seo.title",
        },
      },
      fields: {
        ...fields,
        seo: field.group({
          fields: {
            description: field.textarea({ nullable: true }),
            title: field.text({ nullable: true }),
          },
          nullable: true,
        }),
      },
      publicApi: {
        ...publicApi,
        fields: [...publicApi.fields, "seo.title", "seo.description"],
      },
      tableName: "delivery_group_seo",
    });

    expect(withGroup.delivery.seo).toMatchObject({
      descriptionField: "seo.description",
      fallbackTitleField: "title",
      titleField: "seo.title",
    });
  });

  it("refuses a fallback with no primary, which would never be read", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.orphan-fallback",
        delivery: {
          enabled: true,
          seo: { fallbackTitleField: "title" as never },
        },
        fields,
        publicApi,
        tableName: "delivery_orphan_fallback",
      }),
    ).toThrow(/without `titleField`/);
  });

  it("refuses a sitemap priority outside 0-1", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.bad-priority",
        delivery: { enabled: true, sitemap: { enabled: true, priority: 7 } },
        fields,
        publicApi,
        tableName: "delivery_bad_priority",
      }),
    ).toThrow(/between 0 and 1/);
  });

  it("refuses an unknown change frequency", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.bad-freq",
        delivery: {
          enabled: true,
          sitemap: {
            // A crawler ignores an unknown value silently, so a typo has to be
            // caught here or it is a hint nobody ever receives.
            changeFrequency: "fortnightly" as never,
            enabled: true,
          },
        },
        fields,
        publicApi,
        tableName: "delivery_bad_freq",
      }),
    ).toThrow(/sitemap protocol defines/);
  });

  it("refuses a non-boolean noIndexField", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.bad-noindex",
        delivery: { enabled: true, seo: { noIndexField: "title" as never } },
        fields,
        publicApi,
        tableName: "delivery_bad_noindex",
      }),
    ).toThrow(/Expected one of: boolean/);
  });

  it("refuses x-default without localization", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.bad-xdefault",
        delivery: { enabled: true, hreflang: { xDefault: "defaultLocale" } },
        fields,
        publicApi,
        tableName: "delivery_bad_xdefault",
      }),
    ).toThrow(/delivery.hreflang needs `localization/);
  });

  it("records the slug scope so history knows which language owns a URL", () => {
    expect(articleType.delivery.slugScope).toBe("shared");
    expect(localizedType.delivery.slugScope).toBe("localized");
  });

  it("refuses redirects on a localized content type with a shared slug", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.shared-slug",
        delivery: { enabled: true, redirects: { enabled: true } },
        fields: {
          body: field.textarea({ localized: true, required: true }),
          slug: field.slug({ source: "title" }),
          title: field.text({ required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
        publicApi: {
          enabled: true,
          fields: ["title", "slug", "body"],
          path: "articles",
        },
        tableName: "delivery_shared_slug",
      }),
    ).toThrow(/needs a localized slug field/);
  });

  it("refuses a localized content type that withholds id", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.no-id",
        delivery: { enabled: true },
        fields: {
          slug: field.slug({ localized: true, source: "title" }),
          title: field.text({ localized: true, required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
        publicApi: {
          enabled: true,
          // No `id`, so alternates and `hreflang` could not be resolved - and an
          // empty `hreflang` looks exactly like a record with one translation.
          fields: ["title", "slug"],
          path: "articles",
        },
        tableName: "delivery_no_id",
      }),
    ).toThrow(/needs "id" in publicApi.fields/);
  });

  it("does not require id of a nonlocalized content type", () => {
    // It has no alternates to resolve, so there is nothing the identifier is needed
    // for - `itemId` simply comes back `null` on its delivery metadata.
    const withoutId = defineContentType({
      ...base,
      id: "delivery.no-id-flat",
      delivery: { enabled: true },
      fields,
      publicApi: { enabled: true, fields: ["title", "slug"], path: "articles" },
      tableName: "delivery_no_id_flat",
    });

    expect(withoutId.delivery.enabled).toBe(true);
    expect(withoutId.publicApi.fields).not.toContain("id");
  });

  it("refuses a localized noIndexField", () => {
    expect(() =>
      defineContentType({
        ...base,
        id: "delivery.localized-noindex",
        delivery: {
          enabled: true,
          seo: { noIndexField: "flags.noIndex" as never },
        },
        fields: {
          // A localized group's leaves live on the translation table, so the value
          // would differ per language while the record has one canonical decision.
          flags: field.group({
            fields: { noIndex: field.boolean({ defaultValue: false }) },
            localized: true,
          }),
          slug: field.slug({ localized: true, source: "title" }),
          title: field.text({ localized: true, required: true }),
        },
        localization: { defaultLocale: "en", enabled: true },
        publicApi: {
          enabled: true,
          // `id` because a localized delivery content type has to expose it - see
          // "refuses a localized content type that withholds id" below.
          fields: ["id", "title", "slug", "flags.noIndex"],
          path: "articles",
        },
        tableName: "delivery_localized_noindex",
      }),
    ).toThrow(/has to be shared/);
  });
});

const localizedType = defineContentType({
  ...base,
  id: "delivery.localized",
  delivery: {
    enabled: true,
    hreflang: { xDefault: "defaultLocale" },
    redirects: { enabled: true },
    seo: {
      descriptionField: "seo.description",
      fallbackTitleField: "title",
      titleField: "seo.title",
    },
    sitemap: { changeFrequency: "daily", enabled: true, priority: 0.5 },
  },
  fields: {
    seo: field.group({
      fields: {
        description: field.textarea({ nullable: true }),
        title: field.text({ nullable: true }),
      },
      localized: true,
      nullable: true,
    }),
    slug: field.slug({ localized: true, source: "title" }),
    title: field.text({ localized: true, required: true }),
  },
  localization: { defaultLocale: "en", enabled: true, fallback: "default" },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug", "seo.title", "seo.description"],
    path: "articles",
  },
  tableName: "delivery_localized",
});

describe("contentDeliveryPath", () => {
  it("has no locale segment for a nonlocalized content type", () => {
    expect(
      contentDeliveryPath({ definition: articleType, slug: "my-article" }),
    ).toBe("/articles/my-article");
  });

  it("prefixes the locale for a localized content type", () => {
    expect(
      contentDeliveryPath({
        definition: localizedType,
        locale: "pl",
        slug: "moj-artykul",
      }),
    ).toBe("/pl/articles/moj-artykul");
  });

  it("normalizes the locale, so one URL has one cache key", () => {
    const paths = ["PL", "pl", " pl "].map(locale =>
      contentDeliveryPath({ definition: localizedType, locale, slug: "witaj" }),
    );

    expect(new Set(paths).size).toBe(1);
    expect(paths[0]).toBe("/pl/articles/witaj");
  });

  it("refuses to build a localized path with no locale", () => {
    expect(
      contentDeliveryPath({ definition: localizedType, slug: "witaj" }),
    ).toBeNull();
  });

  it("is null for an empty slug rather than pointing at the list page", () => {
    expect(
      contentDeliveryPath({ definition: articleType, slug: "  " }),
    ).toBeNull();
  });

  it("percent-encodes a slug that was written straight into the database", () => {
    expect(
      contentDeliveryPath({ definition: articleType, slug: "a b/c" }),
    ).toBe("/articles/a%20b%2Fc");
  });
});

describe("contentDeliveryUrl", () => {
  it("resolves a path against an origin, with or without a trailing slash", () => {
    for (const origin of ["https://example.com", "https://example.com/"]) {
      expect(contentDeliveryUrl({ origin, path: "/articles/x" })).toBe(
        "https://example.com/articles/x",
      );
    }
  });

  it("is null for a malformed origin rather than a URL with two schemes", () => {
    expect(contentDeliveryUrl({ origin: "not a url", path: "/x" })).toBeNull();
  });

  it("passes a null path straight through", () => {
    expect(
      contentDeliveryUrl({ origin: "https://example.com", path: null }),
    ).toBeNull();
  });
});

describe("parseContentDeliveryPath", () => {
  it("round-trips the path it builds", () => {
    expect(
      parseContentDeliveryPath(articleType, "/articles/my-article"),
    ).toStrictEqual({ locale: null, slug: "my-article" });

    expect(
      parseContentDeliveryPath(localizedType, "/pl/articles/moj-artykul"),
    ).toStrictEqual({ locale: "pl", slug: "moj-artykul" });
  });

  it("decodes the slug and normalizes the locale", () => {
    expect(
      parseContentDeliveryPath(localizedType, "/PL/articles/a%20b"),
    ).toStrictEqual({ locale: "pl", slug: "a b" });
  });

  it("strips a query string and a fragment", () => {
    expect(
      parseContentDeliveryPath(articleType, "/articles/x?utm=1#top"),
    ).toStrictEqual({ locale: null, slug: "x" });
  });

  it("refuses a path that belongs to another content type", () => {
    expect(parseContentDeliveryPath(articleType, "/news/x")).toBeNull();
  });

  it("refuses the wrong number of segments", () => {
    for (const path of ["/articles", "/articles/a/b", "/pl/articles/a"]) {
      expect(parseContentDeliveryPath(articleType, path)).toBeNull();
    }
  });

  it("refuses a traversal and a malformed escape", () => {
    expect(parseContentDeliveryPath(articleType, "/articles/..")).toBeNull();
    expect(parseContentDeliveryPath(articleType, "/articles/%zz")).toBeNull();
  });

  it("refuses a path longer than the stored column", () => {
    expect(
      parseContentDeliveryPath(articleType, `/articles/${"a".repeat(600)}`),
    ).toBeNull();
  });
});

describe("SEO projection", () => {
  it("reads the configured fields off a public row", () => {
    expect(
      contentDeliverySeo(articleType, {
        excerpt: "A summary.",
        title: "My article",
      }),
    ).toStrictEqual({ description: "A summary.", title: "My article" });
  });

  it("falls back only when the primary is empty", () => {
    expect(
      contentDeliverySeo(localizedType, {
        seo: { description: null, title: "  " },
        title: "The heading",
      }),
    ).toStrictEqual({ description: null, title: "The heading" });

    expect(
      contentDeliverySeo(localizedType, {
        seo: { description: "d", title: "SEO heading" },
        title: "The heading",
      }),
    ).toStrictEqual({ description: "d", title: "SEO heading" });
  });

  it("never invents a description from other content", () => {
    expect(
      contentDeliverySeo(articleType, { excerpt: null, title: "T" }),
    ).toStrictEqual({ description: null, title: "T" });
  });

  it("cannot read a field the public row does not carry", () => {
    // The row is the public projection, so a private field is absent from the
    // object entirely rather than merely skipped.
    expect(contentDeliverySeo(articleType, { views: 9 })).toStrictEqual({
      description: null,
      title: null,
    });
  });

  it("is a stable shape for a content type that configured nothing", () => {
    expect(contentDeliverySeo(plainType, { title: "T" })).toStrictEqual({
      description: null,
      title: null,
    });
  });
});

describe("Open Graph projection", () => {
  it("is null when the content type configured none", () => {
    expect(contentDeliveryOpenGraph(articleType, { title: "T" })).toBeNull();
  });

  it("falls back to the ordinary SEO slots", () => {
    const withOg = defineContentType({
      ...base,
      id: "delivery.og",
      delivery: {
        enabled: true,
        seo: { openGraph: {}, titleField: "title" },
      },
      fields,
      publicApi,
      tableName: "delivery_og",
    });

    expect(
      contentDeliveryOpenGraph(withOg, { title: "Shared heading" }),
    ).toStrictEqual({ description: null, title: "Shared heading" });
  });
});

describe("robots projection", () => {
  it("is null without a noIndexField", () => {
    expect(contentDeliveryRobots(articleType, {})).toBeNull();
  });

  it("reads the boolean and always allows following", () => {
    const withNoIndex = defineContentType({
      ...base,
      id: "delivery.noindex",
      delivery: { enabled: true, seo: { noIndexField: "hidden" } },
      fields,
      publicApi: { ...publicApi, fields: [...publicApi.fields, "hidden"] },
      tableName: "delivery_noindex",
    });

    expect(contentDeliveryRobots(withNoIndex, { hidden: true })).toStrictEqual({
      follow: true,
      index: false,
    });
    expect(contentDeliveryRobots(withNoIndex, { hidden: false })).toStrictEqual(
      {
        follow: true,
        index: true,
      },
    );
  });
});

describe("contentDeliveryHreflang", () => {
  const alternates = [
    { locale: "en", path: "/en/articles/my-article" },
    { locale: "pl", path: "/pl/articles/moj-artykul" },
  ];

  it("maps alternates to a language map", () => {
    expect(
      contentDeliveryHreflang({ alternates, definition: localizedType }),
    ).toStrictEqual({
      languages: {
        en: "/en/articles/my-article",
        pl: "/pl/articles/moj-artykul",
      },
      xDefault: "/en/articles/my-article",
    });
  });

  it("omits x-default when the default locale is not published", () => {
    expect(
      contentDeliveryHreflang({
        alternates: [alternates[1]],
        definition: localizedType,
      }),
    ).toStrictEqual({ languages: { pl: "/pl/articles/moj-artykul" } });
  });

  it("emits no x-default when the content type did not ask for one", () => {
    expect(
      contentDeliveryHreflang({ alternates, definition: articleType }),
    ).toStrictEqual({
      languages: {
        en: "/en/articles/my-article",
        pl: "/pl/articles/moj-artykul",
      },
    });
  });
});

describe("registry helpers", () => {
  it("lists only delivery-enabled content types, in a stable order", () => {
    const entries = [
      { definition: localizedType, pluginId: "b" },
      { definition: plainType, pluginId: "a" },
      { definition: articleType, pluginId: "a" },
    ];

    expect(
      listDeliveryContentTypes(entries).map(entry => entry.definition.id),
    ).toStrictEqual(["delivery.article", "delivery.localized"]);
  });

  it("narrows a definition to a deliverable one", () => {
    expect(isDeliverableContentType(articleType)).toBe(true);
    expect(isDeliverableContentType(plainType)).toBe(false);
  });

  it("reports the sitemap defaults, or nothing", () => {
    expect(contentSitemapDefaults(articleType)).toStrictEqual({
      changeFrequency: "weekly",
      priority: 0.7,
    });
    expect(contentSitemapDefaults(plainType)).toBeNull();
  });
});
