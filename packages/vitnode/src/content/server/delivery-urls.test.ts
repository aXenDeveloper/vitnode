// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import { testContentLocaleRouting } from "@/tests/content-fixtures";

import type { LocaleRouting } from "../../lib/i18n/locale-routing";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { core_content_slug_history } from "../../database/content";
import { core_languages } from "../../database/languages";
import { defineContentType } from "../define";
import { field } from "../fields";
import { contentSitemapXml } from "../sitemap";
import { createContentDeliveryService } from "./delivery-service";
import { createContentModel } from "./model";

const postType = defineContentType({
  id: "deliveryurls.post",
  editorial: { enabled: true },
  delivery: {
    enabled: true,
    hreflang: { xDefault: "defaultLocale" },
    path: "/blog/:slug",
    redirects: { enabled: true },
    sitemap: { enabled: true },
  },
  fields: {
    slug: field.slug({ localized: true, source: "title" }),
    title: field.text({ localized: true, required: true }),
  },
  localization: { defaultLocale: "en", enabled: true, fallback: "default" },
  publication: { enabled: true },
  publicApi: { enabled: true, fields: ["id", "title", "slug"], path: "posts" },
  tableName: "delivery_urls_posts",
});

const ROUTE_PATHS = { pl: { "/blog/:slug": "/wpisy/:slug" } };

const translated = testContentLocaleRouting({ routePaths: ROUTE_PATHS });

const withDomains = testContentLocaleRouting({
  domains: [
    { defaultLocale: "en", origin: "https://vitnode.com" },
    { defaultLocale: "pl", origin: "https://vitnode.pl" },
  ],
  routePaths: ROUTE_PATHS,
});

const LANGUAGES = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
];

const SLUGS: Record<string, string> = {
  en: "hello-world",
  pl: "witaj-swiecie",
};

interface HistoryRow {
  itemId: number;
  languageId: null | number;
  path: string;
  retiredAt: Date | null;
  slug: string;
}

const LAST_MODIFIED = new Date("2026-01-01T00:00:00.000Z");

const buildService = ({
  history = [],
  liveSlugLookup = true,
  published = ["en", "pl"],
  routing,
}: {
  history?: HistoryRow[];
  liveSlugLookup?: boolean;
  published?: string[];
  routing: LocaleRouting;
}) => {
  const real = createContentModel(postType);

  const rowFor = (locale: string | undefined) => {
    const wanted = locale ?? "en";
    const served = published.includes(wanted) ? wanted : "en";

    return { id: 7, locale: served, slug: SLUGS[served], title: "T" };
  };

  const publicService = {
    findById: async (_id: number, options?: { locale?: string }) =>
      await Promise.resolve(rowFor(options?.locale)),
    findBySlug: async (slug: string, options?: { locale?: string }) => {
      const locale = options?.locale ?? "en";
      const live =
        liveSlugLookup && published.includes(locale) && SLUGS[locale] === slug;

      return await Promise.resolve(live ? rowFor(locale) : null);
    },
    findMany: async () =>
      await Promise.resolve({ edges: [], pageInfo: {} as never }),
  };

  const rowsFor = (table: unknown): Record<string, unknown>[] => {
    if (table === core_languages) return LANGUAGES;
    if (table === core_content_slug_history) {
      return history.map(row => ({ createdAt: new Date(0), ...row }));
    }
    if (table === real.translationTable) {
      return LANGUAGES.filter(language =>
        published.includes(language.code),
      ).map(language => ({
        itemId: 7,
        languageId: language.id,
        slug: SLUGS[language.code],
      }));
    }
    if (table === real.table) {
      return [{ itemId: 7, lastModified: LAST_MODIFIED, slug: SLUGS.pl }];
    }

    return [];
  };

  const select = () => {
    let table: unknown;

    const builder = {
      for: () => builder,
      from: (value: unknown) => {
        table = value;

        return builder;
      },
      innerJoin: () => builder,
      limit: () => builder,
      orderBy: () => builder,
      then: async (
        resolve: (rows: Record<string, unknown>[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(rowsFor(table)).then(resolve, reject),
      where: () => builder,
    };

    return builder;
  };

  const core = {
    i18n: {
      defaultLocale: "en",
      localeRouting: routing,
      locales: [
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ],
    },
  };

  const c = {
    get: (key: string) => {
      if (key === "db") return { select };
      if (key === "core") return core;

      return undefined;
    },
  } as unknown as Context;

  const model = {
    ...real,
    publicService: () => publicService,
  } as unknown as ContentModel<AnyContentTypeDefinition>;

  return createContentDeliveryService({ c, model, pluginId: "@vitnode/test" });
};

describe("localized delivery URLs", () => {
  it("gives every language its own URL, slug and translated route", async () => {
    const service = buildService({ routing: translated });

    expect(await service.findById(7, { locale: "en" })).toMatchObject({
      alternates: [
        { locale: "en", path: "/blog/hello-world" },
        { locale: "pl", path: "/pl/wpisy/witaj-swiecie" },
      ],
      canonicalPath: "/blog/hello-world",
      hreflang: {
        languages: {
          en: "/blog/hello-world",
          pl: "/pl/wpisy/witaj-swiecie",
        },
        xDefault: "/blog/hello-world",
      },
    });
    expect(await service.findById(7, { locale: "pl" })).toMatchObject({
      canonicalPath: "/pl/wpisy/witaj-swiecie",
      isFallback: false,
      locale: "pl",
    });
  });

  it("never labels default-language fallback content as a Polish alternate", async () => {
    const service = buildService({ published: ["en"], routing: translated });

    const metadata = await service.findById(7, { locale: "pl" });

    expect(metadata).toMatchObject({
      alternates: [{ locale: "en", path: "/blog/hello-world" }],
      canonicalPath: "/blog/hello-world",
      hreflang: {
        languages: { en: "/blog/hello-world" },
        xDefault: "/blog/hello-world",
      },
      isFallback: true,
      locale: "en",
      requestedLocale: "pl",
    });
    expect(metadata?.hreflang.languages).not.toHaveProperty("pl");
  });

  it("makes canonical URLs and alternates absolute on each language's domain", async () => {
    const service = buildService({ routing: withDomains });

    expect(await service.findById(7, { locale: "pl" })).toMatchObject({
      alternates: [
        {
          locale: "en",
          origin: "https://vitnode.com",
          path: "/blog/hello-world",
        },
        {
          locale: "pl",
          origin: "https://vitnode.pl",
          path: "/wpisy/witaj-swiecie",
        },
      ],
      canonicalPath: "/wpisy/witaj-swiecie",
      canonicalUrl: "https://vitnode.pl/wpisy/witaj-swiecie",
      hreflang: {
        languages: {
          en: "https://vitnode.com/blog/hello-world",
          pl: "https://vitnode.pl/wpisy/witaj-swiecie",
        },
        xDefault: "https://vitnode.com/blog/hello-world",
      },
    });
  });

  it("resolves a translated public path back to its locale and slug", async () => {
    const service = buildService({ routing: translated });

    expect(await service.resolvePath("/pl/wpisy/witaj-swiecie")).toMatchObject({
      canonicalPath: "/pl/wpisy/witaj-swiecie",
      locale: "pl",
      type: "content",
    });
    expect(
      await buildService({ routing: withDomains }).resolvePath(
        "/wpisy/witaj-swiecie",
        { host: "vitnode.pl" },
      ),
    ).toMatchObject({ locale: "pl", type: "content" });
  });
});

describe("historical slugs under the locale routing policy", () => {
  const retiredPolish: HistoryRow = {
    itemId: 7,
    languageId: 2,
    path: "/pl/posts/stary-wpis",
    retiredAt: new Date(),
    slug: "stary-wpis",
  };

  it("redirects inside the same language, whatever shape the stored path has", async () => {
    const service = buildService({
      history: [retiredPolish],
      routing: translated,
    });

    expect(await service.resolvePath("/pl/wpisy/stary-wpis")).toStrictEqual({
      location: "/pl/wpisy/witaj-swiecie",
      status: 308,
      type: "redirect",
    });
    expect(await service.resolvePath("/pl/posts/stary-wpis")).toStrictEqual({
      location: "/pl/wpisy/witaj-swiecie",
      status: 308,
      type: "redirect",
    });
  });

  it("stays relative on the language's own host and crosses to it otherwise", async () => {
    const service = buildService({
      history: [retiredPolish],
      routing: withDomains,
    });

    expect(
      await service.resolveSlug("stary-wpis", {
        host: "vitnode.pl",
        locale: "pl",
      }),
    ).toMatchObject({ location: "/wpisy/witaj-swiecie" });
    expect(
      await service.resolveSlug("stary-wpis", { locale: "pl" }),
    ).toMatchObject({ location: "https://vitnode.pl/wpisy/witaj-swiecie" });
  });

  it("never redirects the live slug to itself", async () => {
    const service = buildService({
      history: [{ ...retiredPolish, slug: "witaj-swiecie" }],
      liveSlugLookup: false,
      routing: translated,
    });

    expect(
      await service.resolveSlug("witaj-swiecie", { locale: "pl" }),
    ).toStrictEqual({ type: "not_found" });
  });

  it("reports history in the current URL shape rather than the stored one", async () => {
    const service = buildService({
      history: [retiredPolish],
      routing: translated,
    });

    expect(await service.history(7, { locale: "pl" })).toMatchObject([
      { path: "/pl/wpisy/stary-wpis", slug: "stary-wpis" },
    ]);
  });
});

describe("sitemap URLs", () => {
  it("lists each language's entries on its own domain", async () => {
    const service = buildService({ routing: withDomains });

    const page = await service.sitemap({ locale: "pl" });

    expect(page.entries).toMatchObject([
      {
        itemId: 7,
        locale: "pl",
        origin: "https://vitnode.pl",
        path: "/wpisy/witaj-swiecie",
      },
    ]);
    expect(
      contentSitemapXml({
        alternates: new Map([[7, await service.alternates(7)]]),
        entries: page.entries,
        origin: "https://example.com",
      }),
    ).toContain("<loc>https://vitnode.pl/wpisy/witaj-swiecie</loc>");
  });

  it("keeps prefixed relative paths without domains", async () => {
    const page = await buildService({ routing: translated }).sitemap({
      locale: "pl",
    });

    expect(page.entries).toMatchObject([
      { locale: "pl", path: "/pl/wpisy/witaj-swiecie" },
    ]);
    expect(page.entries[0]).not.toHaveProperty("origin");
  });
});
