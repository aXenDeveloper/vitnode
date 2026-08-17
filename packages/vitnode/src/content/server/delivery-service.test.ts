import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { core_content_slug_history } from "../../database/content";
import { core_languages } from "../../database/languages";
import { defineContentType } from "../define";
import { field } from "../fields";
import { createContentDeliveryService } from "./delivery-service";

/**
 * The delivery resolver, against the real service, without a database.
 *
 * The two reads it performs - the public projection and the slug-history lookup -
 * are stubbed, and nothing else is: `createContentDeliveryService` is the code under
 * test, so the decision it makes (canonical, redirect, or nothing) is the thing
 * being asserted rather than a copy of it. That decision is where a mistake becomes
 * a permanent 308 to the wrong page, which is exactly why it is worth testing
 * without the ceremony of a database.
 *
 * The queries themselves are covered by the Postgres suite in `plugins/example`.
 */

const PLUGIN = "@vitnode/test";

const articleType = defineContentType({
  id: "delivery.article",
  editorial: { enabled: true },
  delivery: {
    enabled: true,
    redirects: { enabled: true },
    seo: { descriptionField: "excerpt", titleField: "title" },
    sitemap: { enabled: true, priority: 0.7 },
  },
  fields: {
    excerpt: field.textarea({ nullable: true }),
    slug: field.slug({ source: "title" }),
    title: field.text({ required: true }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug", "excerpt"],
    path: "articles",
  },
  tableName: "delivery_articles",
});

const withoutRedirects = defineContentType({
  id: "delivery.no-redirects",
  delivery: { enabled: true, sitemap: { enabled: true } },
  fields: {
    slug: field.slug({ source: "title" }),
    title: field.text({ required: true }),
  },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug"],
    path: "articles",
  },
  tableName: "delivery_no_redirects",
});

const localizedType = defineContentType({
  id: "delivery.localized",
  editorial: { enabled: true },
  delivery: {
    enabled: true,
    hreflang: { xDefault: "defaultLocale" },
    redirects: { enabled: true },
    seo: { fallbackTitleField: "title", titleField: "seo.title" },
    sitemap: { enabled: true },
  },
  fields: {
    seo: field.group({
      fields: { title: field.text({ nullable: true }) },
      localized: true,
      nullable: true,
    }),
    slug: field.slug({ localized: true, source: "title" }),
    title: field.text({ localized: true, required: true }),
  },
  localization: { defaultLocale: "en", enabled: true, fallback: "default" },
  publication: { enabled: true },
  publicApi: {
    enabled: true,
    fields: ["id", "title", "slug", "seo.title"],
    path: "articles",
  },
  tableName: "delivery_localized_articles",
});

/** One retired or current address, as `core_content_slug_history` stores it. */
interface HistoryRow {
  itemId: number;
  languageId: null | number;
  path: string;
  retiredAt: Date | null;
  slug: string;
}

/** One public row, and the language it is in. */
interface PublicRow {
  locale?: string;
  values: Record<string, unknown>;
}

type QueryRows = Record<string, unknown>[];

/**
 * A Drizzle query builder that resolves to whatever the table asks for.
 *
 * A thenable rather than a promise-returning `limit()`, because the two reads this
 * file needs end differently: the language registry awaits straight off `.from()`
 * and the history lookup chains `.where().limit(1)` (and sometimes `.for("update")`).
 * One thenable satisfies both without the stub having to know which.
 */
const buildDatabase = (rowsFor: (table: unknown) => QueryRows): unknown => {
  const select = () => {
    let table: unknown;

    const builder = {
      for: () => builder,
      from: (value: unknown) => {
        table = value;

        return builder;
      },
      limit: () => builder,
      orderBy: () => builder,
      then: async (
        resolve: (rows: QueryRows) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(rowsFor(table)).then(resolve, reject),
      where: () => builder,
    };

    return builder;
  };

  return { select };
};

/**
 * A model whose public service is a map and whose history table is an array.
 *
 * `findById` mimics the Stage 5 fallback rule rather than re-deriving it: a locale
 * with no row of its own is served the default one, and the row says which language
 * it is actually in. That is the contract `createContentLocalizedPublicService`
 * holds, and reading through it is the whole reason delivery inherits the
 * publication predicate and the field allowlist for free.
 */
const buildService = ({
  byId = {},
  bySlug = {},
  definition,
  history = [],
  languages = [
    { code: "en", id: 1 },
    { code: "pl", id: 2 },
  ],
}: {
  byId?: Record<number, PublicRow[]>;
  bySlug?: Record<string, { itemId: number; locale?: string }>;
  definition: AnyContentTypeDefinition;
  history?: HistoryRow[];
  languages?: { code: string; id: number }[];
}) => {
  const localized = definition.localization.enabled;
  const defaultLocale = definition.localization.defaultLocale;

  const rowFor = (
    itemId: number,
    locale: string | undefined,
  ): null | Record<string, unknown> => {
    const rows = byId[itemId] ?? [];
    if (!localized) return rows[0]?.values ?? null;

    const wanted = (locale ?? defaultLocale).toLowerCase();
    const exact = rows.find(entry => entry.locale === wanted);
    if (exact) return { ...exact.values, locale: exact.locale };

    if (definition.localization.fallback !== "default") return null;

    const fallback = rows.find(entry => entry.locale === defaultLocale);

    return fallback ? { ...fallback.values, locale: fallback.locale } : null;
  };

  const publicService = {
    findById: async (id: number, options?: { locale?: string }) =>
      await Promise.resolve(rowFor(id, options?.locale)),
    findBySlug: async (slug: string, options?: { locale?: string }) => {
      const hit = bySlug[slug];
      if (!hit) return await Promise.resolve(null);
      // Strict-locale, exactly as the real service is: a URL belongs to the
      // language it was published under.
      if (
        localized &&
        hit.locale !== (options?.locale ?? defaultLocale).toLowerCase()
      ) {
        return await Promise.resolve(null);
      }

      return await Promise.resolve(rowFor(hit.itemId, hit.locale));
    },
    findMany: async () =>
      await Promise.resolve({ edges: [], pageInfo: {} as never }),
  };

  const database = buildDatabase(table => {
    if (table === core_languages) {
      return languages.map(language => ({
        code: language.code,
        id: language.id,
        isDefault: language.code === defaultLocale,
      }));
    }

    if (table === core_content_slug_history) {
      // The resolver asks for one address at a time, so the stub returns the whole
      // set and relies on the service having narrowed it - which it cannot here.
      // Each test therefore supplies at most one row.
      return history.map(row => ({ createdAt: new Date(0), ...row }));
    }

    return [];
  });

  const c = {
    get: (key: string) => {
      if (key === "db") return database;
      if (key === "core") return { i18n: { locales: [] } };

      return undefined;
    },
  } as unknown as Context;

  const model = {
    columns: {},
    definition,
    publicService: () => publicService,
    table: {},
    translationColumns: null,
    translationTable: null,
  } as unknown as ContentModel<AnyContentTypeDefinition>;

  return createContentDeliveryService({ c, model, pluginId: PLUGIN });
};

const article = (slug: string, id = 42): PublicRow => ({
  values: { excerpt: null, id, slug, title: "T" },
});

const translation = (locale: string, slug: string, id = 7): PublicRow => ({
  locale,
  values: { id, seo: { title: null }, slug, title: "T" },
});

describe("createContentDeliveryService", () => {
  it("refuses a content type with no delivery block", () => {
    const plain = defineContentType({
      id: "delivery.none",
      fields: {
        slug: field.slug({ source: "title" }),
        title: field.text({ required: true }),
      },
      publication: { enabled: true },
      publicApi: { enabled: true, fields: ["title", "slug"], path: "p" },
      tableName: "delivery_none",
    });

    expect(() => buildService({ definition: plain })).toThrow(
      /no `delivery` block/,
    );
  });
});

describe("resolveSlug", () => {
  it("answers the current slug as canonical content", async () => {
    const service = buildService({
      byId: { 42: [article("current")] },
      bySlug: { current: { itemId: 42 } },
      definition: articleType,
    });

    expect(await service.resolveSlug("current")).toMatchObject({
      canonicalPath: "/articles/current",
      itemId: 42,
      type: "content",
    });
  });

  it("redirects a retired slug to the current canonical path", async () => {
    const service = buildService({
      byId: { 42: [article("current")] },
      bySlug: { current: { itemId: 42 } },
      definition: articleType,
      history: [
        {
          itemId: 42,
          languageId: null,
          path: "/articles/old",
          retiredAt: new Date(),
          slug: "old",
        },
      ],
    });

    expect(await service.resolveSlug("old")).toStrictEqual({
      location: "/articles/current",
      status: 308,
      type: "redirect",
    });
  });

  it("collapses a chain: both a and b resolve straight to c", async () => {
    for (const retired of ["a", "b"]) {
      const service = buildService({
        byId: { 42: [article("c")] },
        bySlug: { c: { itemId: 42 } },
        definition: articleType,
        history: [
          {
            itemId: 42,
            languageId: null,
            path: `/articles/${retired}`,
            retiredAt: new Date(),
            slug: retired,
          },
        ],
      });

      // One hop, not two: the resolver reads the record's *current* slug rather
      // than the next entry in the chain.
      expect(await service.resolveSlug(retired)).toStrictEqual({
        location: "/articles/c",
        status: 308,
        type: "redirect",
      });
    }
  });

  it("is not_found when the destination is no longer public", async () => {
    const service = buildService({
      // No public row: an unpublished or deleted record looks like this from here.
      byId: {},
      bySlug: {},
      definition: articleType,
      history: [
        {
          itemId: 42,
          languageId: null,
          path: "/articles/old",
          retiredAt: new Date(),
          slug: "old",
        },
      ],
    });

    expect(await service.resolveSlug("old")).toStrictEqual({
      type: "not_found",
    });
  });

  it("is not_found for a slug nothing has ever used", async () => {
    const service = buildService({ definition: articleType });

    expect(await service.resolveSlug("never-existed")).toStrictEqual({
      type: "not_found",
    });
  });

  it("never redirects a slug to itself", async () => {
    const service = buildService({
      byId: { 42: [article("same")] },
      // The live lookup misses - a stale reservation - and the destination equals
      // the address asked for. A redirect loop is worse than a 404.
      bySlug: {},
      definition: articleType,
      history: [
        {
          itemId: 42,
          languageId: null,
          path: "/articles/same",
          retiredAt: null,
          slug: "same",
        },
      ],
    });

    expect(await service.resolveSlug("same")).toStrictEqual({
      type: "not_found",
    });
  });

  it("never reads the history without redirects", async () => {
    const service = buildService({
      byId: { 42: [{ values: { id: 42, slug: "current", title: "T" } }] },
      bySlug: {},
      definition: withoutRedirects,
      history: [
        {
          itemId: 42,
          languageId: null,
          path: "/articles/old",
          retiredAt: new Date(),
          slug: "old",
        },
      ],
    });

    expect(await service.resolveSlug("old")).toStrictEqual({
      type: "not_found",
    });
  });
});

describe("localized resolveSlug", () => {
  it("keeps a locale's redirect inside its own language", async () => {
    const service = buildService({
      byId: { 7: [translation("en", "hello-world")] },
      bySlug: {},
      definition: localizedType,
      history: [
        {
          itemId: 7,
          languageId: 1,
          path: "/en/articles/hello",
          retiredAt: new Date(),
          slug: "hello",
        },
      ],
    });

    expect(await service.resolveSlug("hello", { locale: "en" })).toStrictEqual({
      location: "/en/articles/hello-world",
      status: 308,
      type: "redirect",
    });
  });

  it("refuses to point one locale's URL at another language's page", async () => {
    const service = buildService({
      // Published in English only. A Polish historical URL must not 308 to the
      // English page: that is the wrong language under a URL that says otherwise,
      // declared permanent.
      byId: { 7: [translation("en", "hello")] },
      bySlug: {},
      definition: localizedType,
      history: [
        {
          itemId: 7,
          languageId: 2,
          path: "/pl/articles/witaj",
          retiredAt: new Date(),
          slug: "witaj",
        },
      ],
    });

    expect(await service.resolveSlug("witaj", { locale: "pl" })).toStrictEqual({
      type: "not_found",
    });
  });

  it("resolves a slug strictly, never through the fallback", async () => {
    const service = buildService({
      byId: { 7: [translation("en", "hello")] },
      bySlug: { hello: { itemId: 7, locale: "en" } },
      definition: localizedType,
    });

    // `/pl/articles/hello` is not the English article, even though the content type
    // falls back to English for a *read*.
    expect(await service.resolveSlug("hello", { locale: "pl" })).toStrictEqual({
      type: "not_found",
    });
    expect(await service.resolveSlug("hello", { locale: "en" })).toMatchObject({
      canonicalPath: "/en/articles/hello",
      type: "content",
    });
  });
});

describe("findById", () => {
  it("reports the served locale, not the requested one, on a fallback", async () => {
    const service = buildService({
      byId: { 7: [translation("en", "hello")] },
      definition: localizedType,
    });

    const metadata = await service.findById(7, { locale: "pl" });

    // `/pl/articles/hello` would be a self-declared canonical that answers 404.
    expect(metadata).toMatchObject({
      canonicalPath: "/en/articles/hello",
      isFallback: true,
      locale: "en",
      requestedLocale: "pl",
    });
  });

  it("is not a fallback when the locale differs only in casing", async () => {
    const service = buildService({
      byId: { 7: [translation("en", "hello")] },
      definition: localizedType,
    });

    expect(await service.findById(7, { locale: "EN" })).toMatchObject({
      isFallback: false,
      locale: "en",
    });
  });

  it("projects the SEO fallback field when the primary is empty", async () => {
    const service = buildService({
      byId: {
        7: [
          {
            locale: "en",
            values: {
              id: 7,
              seo: { title: null },
              slug: "hello",
              title: "The heading",
            },
          },
        ],
      },
      definition: localizedType,
    });

    expect((await service.findById(7, { locale: "en" }))?.seo).toStrictEqual({
      description: null,
      title: "The heading",
    });
  });

  it("is null for a record with no public version", async () => {
    const service = buildService({ definition: articleType });

    expect(await service.findById(99)).toBeNull();
  });

  it("adds an absolute URL only when an origin is supplied", async () => {
    const service = buildService({
      byId: { 42: [article("hello")] },
      definition: articleType,
    });

    expect(await service.findById(42)).not.toHaveProperty("canonicalUrl");
    expect(
      await service.findById(42, { origin: "https://example.com" }),
    ).toMatchObject({ canonicalUrl: "https://example.com/articles/hello" });
  });

  it("carries no alternates for a nonlocalized content type", async () => {
    const service = buildService({
      byId: { 42: [article("hello")] },
      definition: articleType,
    });

    expect(await service.findById(42)).toMatchObject({
      alternates: [],
      hreflang: { languages: {} },
    });
  });
});

describe("resolvePath", () => {
  it("refuses a path that belongs to another content type", async () => {
    const service = buildService({ definition: articleType });

    expect(await service.resolvePath("/news/hello")).toStrictEqual({
      type: "not_found",
    });
  });

  it("resolves a canonical path through the public read", async () => {
    const service = buildService({
      byId: { 42: [article("hello")] },
      bySlug: { hello: { itemId: 42 } },
      definition: articleType,
    });

    expect(await service.resolvePath("/articles/hello")).toMatchObject({
      canonicalPath: "/articles/hello",
      type: "content",
    });
  });

  it("splits the locale out of a localized path", async () => {
    const service = buildService({
      byId: { 7: [translation("pl", "witaj")] },
      bySlug: { witaj: { itemId: 7, locale: "pl" } },
      definition: localizedType,
    });

    expect(await service.resolvePath("/pl/articles/witaj")).toMatchObject({
      canonicalPath: "/pl/articles/witaj",
      locale: "pl",
      type: "content",
    });
  });

  it("redirects a retired localized path", async () => {
    const service = buildService({
      byId: { 7: [translation("pl", "nowy-slug")] },
      bySlug: {},
      definition: localizedType,
      history: [
        {
          itemId: 7,
          languageId: 2,
          path: "/pl/articles/stary-slug",
          retiredAt: new Date(),
          slug: "stary-slug",
        },
      ],
    });

    expect(await service.resolvePath("/pl/articles/stary-slug")).toStrictEqual({
      location: "/pl/articles/nowy-slug",
      status: 308,
      type: "redirect",
    });
  });
});

describe("sitemap", () => {
  it("is an empty page for a content type that lists nothing", async () => {
    const noSitemap = defineContentType({
      id: "delivery.no-sitemap",
      delivery: { enabled: true },
      fields: {
        slug: field.slug({ source: "title" }),
        title: field.text({ required: true }),
      },
      publication: { enabled: true },
      publicApi: { enabled: true, fields: ["id", "title", "slug"], path: "a" },
      tableName: "delivery_no_sitemap",
    });

    // An empty page rather than a throw: a site-level index enumerates every
    // delivery-enabled content type, and one of them opting out is a choice.
    expect(
      await buildService({ definition: noSitemap }).sitemap(),
    ).toStrictEqual({ entries: [], nextCursor: null });
  });
});
