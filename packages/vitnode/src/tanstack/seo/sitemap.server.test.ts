import type { LocaleConfig } from "@vitnode/api/lib/i18n/types";

import { contentDeliverySitemapTag } from "@vitnode/api/content/cache";
import {
  invalidatePageCacheTags,
  resetPageCacheStore,
} from "@vitnode/api/page-cache/store.server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VitNodeConfig } from "@/vitnode.config";

import type { SeoSitemapCache } from "./cache.server";
import type {
  SeoContentSitemapEntry,
  SeoContentSitemapFetch,
  SeoContentSitemapPageRequest,
} from "./content-transport.server";
import type { SeoContentSitemapSource } from "./manifest";
import type { SeoSitemapListSource } from "./sitemap.server";
import type { VitNodeSeoConfig } from "./types";

import { createSeoSitemapCache } from "./cache.server";
import { SeoConfigError } from "./policy.server";
import { createSeoHandler } from "./server";

const WEB = "https://example.com";
const NOW = new Date("2026-03-01T00:00:00Z");

const POSTS: SeoContentSitemapSource = {
  contentTypeId: "blog.post",
  file: "blog",
  localized: false,
  module: "content/blog",
  path: "/delivery/sitemap",
  pluginId: "@vitnode/blog",
};

const DOCS: SeoContentSitemapSource = {
  contentTypeId: "docs.page",
  file: "docs",
  localized: true,
  module: "content/docs",
  path: "/delivery/sitemap",
  pluginId: "@vitnode/docs",
};

const LOCALES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
] satisfies LocaleConfig[];

const PREFIXED: VitNodeConfig["i18n"] = {
  defaultLocale: "en",
  locales: LOCALES,
};

const DOMAINS: VitNodeConfig["i18n"] = {
  defaultLocale: "en",
  domains: [
    { defaultLocale: "en", origin: WEB },
    { defaultLocale: "pl", origin: "https://example.pl" },
  ],
  locales: LOCALES,
};

const post = (index: number): SeoContentSitemapEntry => ({
  changeFrequency: null,
  lastModified: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
  path: `/blog/post-${String(index)}`,
  priority: null,
});

/**
 * A delivery route over `count()` records, numbered from 1, with the offset as
 * its cursor. `count` is read per call, so a test can change the data.
 */
const pagedSource = (
  count: () => number,
  entry: (index: number) => SeoContentSitemapEntry = post,
) =>
  vi.fn<SeoContentSitemapFetch>(
    async ({ cursor, limit }: SeoContentSitemapPageRequest) => {
      const start = cursor === null ? 0 : Number(cursor);
      const end = Math.min(start + limit, count());
      const entries = Array.from({ length: Math.max(0, end - start) }, (_, i) =>
        entry(start + i + 1),
      );

      return await Promise.resolve({
        entries,
        nextCursor: end < count() ? String(end) : null,
      });
    },
  );

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(done => {
    resolve = done;
  });

  return { promise, resolve };
};

/** Background generation the handler started, drained before each test ends. */
const background: Promise<unknown>[] = [];

/** Lets background generation finish. */
const settle = async () => {
  while (background.length > 0) await background.shift();
};

const setup = ({
  cache = createSeoSitemapCache("memory"),
  fetchPage = pagedSource(() => 0),
  i18n = PREFIXED,
  seo = { indexing: true },
  sources = [POSTS],
  lists = [],
}: {
  cache?: SeoSitemapCache;
  fetchPage?: SeoContentSitemapFetch;
  i18n?: VitNodeConfig["i18n"];
  lists?: SeoSitemapListSource[];
  seo?: VitNodeSeoConfig;
  sources?: SeoContentSitemapSource[];
} = {}) => {
  const render = vi.fn(
    async () => await Promise.resolve(new Response("app", { status: 404 })),
  );
  const handler = createSeoHandler(
    render,
    {
      config: {
        config: { i18n, metadata: { title: "Test" }, plugins: [] },
        seo,
      },
      sitemap: { revision: "test", sources },
      sources: lists,
    },
    { cache, fetchPage, webOrigin: WEB },
  );

  const request = async (url: string, init: RequestInit = {}) => {
    const incoming = Object.assign(new Request(new URL(url, WEB), init), {
      waitUntil: (promise: Promise<unknown>) => {
        background.push(promise);
      },
    });
    const response = await handler(incoming);

    return { body: await response.text(), response };
  };

  return { render, request, settle };
};

const locs = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);

beforeEach(() => {
  resetPageCacheStore();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await settle();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetPageCacheStore();
});

describe("the sitemap index", () => {
  it("lists the app pages, list sources and content files", async () => {
    const { request } = setup({
      fetchPage: pagedSource(() => 3),
      lists: [{ id: "guides", urls: () => [{ path: "/guides/start" }] }],
      seo: { indexing: true, sitemap: { paths: ["/", "/about"] } },
    });

    const { body, response } = await request("/sitemap.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
    expect(body).toContain("<sitemapindex");
    expect(locs(body)).toEqual([
      `${WEB}/sitemap-pages-1.xml`,
      `${WEB}/sitemap-guides-1.xml`,
      `${WEB}/sitemap-blog-1.xml`,
    ]);
  });

  it("splits content into files of at most 1,000 URLs", async () => {
    const { request } = setup({ fetchPage: pagedSource(() => 2_500) });

    const index = await request("/sitemap.xml");
    const parts = await Promise.all(
      [1, 2, 3].map(
        async part => await request(`/sitemap-blog-${String(part)}.xml`),
      ),
    );

    expect(locs(index.body)).toEqual([
      `${WEB}/sitemap-blog-1.xml`,
      `${WEB}/sitemap-blog-2.xml`,
      `${WEB}/sitemap-blog-3.xml`,
    ]);
    expect(parts.map(({ body }) => locs(body).length)).toEqual([
      1_000, 1_000, 500,
    ]);
    expect(locs(parts[1].body)[0]).toBe(`${WEB}/blog/post-1001`);
  });

  it("dates each file by its newest URL and leaves undated files without lastmod", async () => {
    const { request } = setup({
      fetchPage: pagedSource(() => 1_200),
      lists: [{ id: "guides", urls: () => [{ path: "/guides/start" }] }],
    });

    const { body } = await request("/sitemap.xml");

    expect(body.match(/<lastmod>[^<]*<\/lastmod>/g)).toEqual([
      `<lastmod>${post(1_000).lastModified?.toISOString() ?? ""}</lastmod>`,
      `<lastmod>${post(1_200).lastModified?.toISOString() ?? ""}</lastmod>`,
    ]);
  });

  it("is generated once and then served from the cache", async () => {
    const fetchPage = pagedSource(() => 2_500);
    const { request } = setup({ fetchPage });

    const first = await request("/sitemap.xml");
    await request("/sitemap-blog-2.xml");
    const second = await request("/sitemap.xml");
    await request("/sitemap-blog-2.xml");

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(second.body).toBe(first.body);
  });

  it("answers a matching If-None-Match with 304", async () => {
    const { request } = setup({ fetchPage: pagedSource(() => 1) });
    const first = await request("/sitemap.xml");
    const etag = first.response.headers.get("etag") ?? "";

    const again = await request("/sitemap.xml", {
      headers: { "if-none-match": `"other", ${etag}` },
    });

    expect(etag).not.toBe("");
    expect(first.response.headers.get("cache-control")).toBe("no-cache");
    expect(again.response.status).toBe(304);
    expect(again.body).toBe("");
  });
});

describe("child files", () => {
  it.each([
    "/sitemap-nope-1.xml",
    "/sitemap-blog-4.xml",
    "/sitemap-pages-1.xml",
    "/sitemap-docs-en-1.xml",
  ])("answers 404 for %s", async path => {
    const { request } = setup({ fetchPage: pagedSource(() => 2_500) });

    const { response } = await request(path);

    expect(response.status).toBe(404);
  });

  it("escapes URLs for XML", async () => {
    const { request } = setup({
      fetchPage: pagedSource(
        () => 1,
        () => ({
          changeFrequency: null,
          lastModified: null,
          path: "/search?a=1&b=<2>",
          priority: null,
        }),
      ),
    });

    const { body } = await request("/sitemap-blog-1.xml");

    expect(locs(body)).toEqual([`${WEB}/search?a=1&amp;b=%3C2%3E`]);
  });

  it("drops list URLs on untrusted origins and repeated URLs", async () => {
    const { request } = setup({
      lists: [
        {
          id: "guides",
          urls: () => [
            { path: "/guides/a" },
            { path: "/guides/a" },
            { origin: "https://evil.test", path: "/guides/b" },
            { path: "/guides/c?x=1&y=2" },
          ],
        },
      ],
      sources: [],
    });

    const { body } = await request("/sitemap-guides-1.xml");

    expect(locs(body)).toEqual([
      `${WEB}/guides/a`,
      `${WEB}/guides/c?x=1&amp;y=2`,
    ]);
  });

  it("lists each app path once per locale with hreflang alternates", async () => {
    const { request } = setup({
      seo: { indexing: true, sitemap: { paths: ["/about"] } },
      sources: [],
    });

    const { body } = await request("/sitemap-pages-1.xml");

    expect(locs(body)).toEqual([`${WEB}/about`, `${WEB}/pl/about`]);
    expect(body).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${WEB}/about" />`,
    );
  });

  it.each<[string, SeoSitemapListSource]>([
    ["reserved id", { id: "pages", urls: () => [] }],
    ["invalid id", { id: "My_Docs", urls: () => [] }],
  ])("rejects a list source with a %s at startup", (_, source) => {
    expect(() => setup({ lists: [source] })).toThrow(SeoConfigError);
  });
});

describe("one origin per host", () => {
  const docs = (locale: null | string) =>
    vi.fn<SeoContentSitemapFetch>(
      async request =>
        await Promise.resolve({
          entries: [
            {
              changeFrequency: null,
              lastModified: null,
              origin: request.locale === "pl" ? "https://example.pl" : WEB,
              path: `/docs/${request.locale ?? locale ?? "x"}`,
              priority: null,
            },
            {
              changeFrequency: null,
              lastModified: null,
              origin: "https://evil.test",
              path: "/docs/elsewhere",
              priority: null,
            },
          ],
          nextCursor: null,
        }),
    );

  it("lists only the locales a host serves", async () => {
    const { request } = setup({
      fetchPage: docs(null),
      i18n: DOMAINS,
      sources: [DOCS, POSTS],
    });

    const [main, pl] = await Promise.all([
      request(`${WEB}/sitemap.xml`),
      request("https://example.pl/sitemap.xml"),
    ]);

    expect(locs(main.body)).toEqual([
      `${WEB}/sitemap-docs-en-1.xml`,
      `${WEB}/sitemap-blog-1.xml`,
    ]);
    expect(locs(pl.body)).toEqual(["https://example.pl/sitemap-docs-pl-1.xml"]);
    expect(
      (await request("https://example.pl/sitemap-docs-en-1.xml")).response
        .status,
    ).toBe(404);
  });

  it("drops entries that belong to another origin", async () => {
    const { request } = setup({
      fetchPage: docs(null),
      i18n: DOMAINS,
      sources: [DOCS],
    });

    const [main, pl] = await Promise.all([
      request(`${WEB}/sitemap-docs-en-1.xml`),
      request("https://example.pl/sitemap-docs-pl-1.xml"),
    ]);

    expect(locs(main.body)).toEqual([`${WEB}/docs/en`]);
    expect(locs(pl.body)).toEqual(["https://example.pl/docs/pl"]);
  });

  it("serves an untrusted Host the web origin's sitemap", async () => {
    const { request } = setup({ fetchPage: pagedSource(() => 1) });

    const { body } = await request("https://evil.test/sitemap.xml");

    expect(locs(body)).toEqual([`${WEB}/sitemap-blog-1.xml`]);
  });
});

describe("evicted parts", () => {
  /** A cache that can lose every stored part, as an LRU under pressure would. */
  const evictableCache = () => {
    const cache = createSeoSitemapCache("memory");
    let evicting = false;

    return {
      cache: {
        ...cache,
        get: async <T>(key: string) =>
          evicting && key.includes(":x:") ? null : await cache.get<T>(key),
      } satisfies SeoSitemapCache,
      evict: () => {
        evicting = true;
      },
    };
  };

  it("re-reads only that part, from the cursor it starts at", async () => {
    const { cache, evict } = evictableCache();
    const fetchPage = pagedSource(() => 2_500);
    const { request } = setup({ cache, fetchPage });
    await request("/sitemap.xml");
    evict();
    fetchPage.mockClear();

    const { body, response } = await request("/sitemap-blog-3.xml");

    expect(response.status).toBe(200);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage.mock.calls[0][0].cursor).toBe("2000");
    expect(locs(body)).toHaveLength(500);
  });

  it("answers 503, uncached, when the data moved under the part", async () => {
    const { cache, evict } = evictableCache();
    let count = 2_500;
    const { request } = setup({ cache, fetchPage: pagedSource(() => count) });
    await request("/sitemap.xml");
    evict();
    count = 1_800;

    const { response } = await request("/sitemap-blog-2.xml");

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("failures and invalidation", () => {
  it("answers 503 and caches nothing while the source fails", async () => {
    let failing = true;
    const working = pagedSource(() => 2);
    const fetchPage = vi.fn<SeoContentSitemapFetch>(async request => {
      if (failing) throw new Error("API down");

      return await working(request);
    });
    const { request } = setup({ fetchPage });

    const [index, child] = await Promise.all([
      request("/sitemap.xml"),
      request("/sitemap-blog-1.xml"),
    ]);
    failing = false;
    const recovered = await request("/sitemap.xml");

    expect([index.response.status, child.response.status]).toEqual([503, 503]);
    expect(recovered.response.status).toBe(200);
    expect(locs(recovered.body)).toEqual([`${WEB}/sitemap-blog-1.xml`]);
  });

  it("answers 503 for a source that hands back the cursor it was given", async () => {
    const fetchPage = vi.fn<SeoContentSitemapFetch>(
      async () =>
        await Promise.resolve({ entries: [post(1)], nextCursor: "stuck" }),
    );
    const { request } = setup({ fetchPage });

    const { response } = await request("/sitemap.xml");

    expect(response.status).toBe(503);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("keeps serving the last generation when a refresh fails", async () => {
    let failing = false;
    const working = pagedSource(() => 2);
    const fetchPage = vi.fn<SeoContentSitemapFetch>(async request => {
      if (failing) throw new Error("API down");

      return await working(request);
    });
    const { request, settle } = setup({ fetchPage });
    const first = await request("/sitemap-blog-1.xml");
    await vi.advanceTimersByTimeAsync(5_000);
    await invalidatePageCacheTags(
      [contentDeliverySitemapTag(POSTS.contentTypeId)],
      {
        mode: "soft",
      },
    );
    failing = true;
    fetchPage.mockClear();

    const stale = await request("/sitemap-blog-1.xml");
    await settle();
    const after = await request("/sitemap-blog-1.xml");

    expect(fetchPage).toHaveBeenCalled();
    expect(stale.response.status).toBe(200);
    expect(stale.body).toBe(first.body);
    expect(after.body).toBe(first.body);
  });

  it("stops listing a removed URL after a hard invalidation", async () => {
    let count = 3;
    const { request } = setup({ fetchPage: pagedSource(() => count) });
    const before = await request("/sitemap-blog-1.xml");
    await vi.advanceTimersByTimeAsync(5_000);

    count = 2;
    await invalidatePageCacheTags(
      [contentDeliverySitemapTag(POSTS.contentTypeId)],
      {
        mode: "hard",
      },
    );
    await vi.advanceTimersByTimeAsync(1);
    const after = await request("/sitemap-blog-1.xml");

    expect(locs(before.body)).toContain(`${WEB}/blog/post-3`);
    expect(after.response.status).toBe(200);
    expect(locs(after.body)).toEqual([
      `${WEB}/blog/post-1`,
      `${WEB}/blog/post-2`,
    ]);
  });

  it("never publishes a build that a hard invalidation overtook", async () => {
    // Nine delivery pages: more than one request reads, so the build is kept
    // in the cache and finished in the background.
    let renamed = false;
    const gate = deferred();
    const paged = pagedSource(
      () => 8_500,
      index =>
        index === 1 && renamed
          ? { ...post(1), path: "/blog/renamed" }
          : post(index),
    );
    const fetchPage = vi.fn<SeoContentSitemapFetch>(async request => {
      if (request.cursor === "8000") await gate.promise;

      return await paged(request);
    });
    const { request, settle } = setup({ fetchPage });

    const first = await request("/sitemap.xml");
    // Page one, already read, lists the old URL; then the slug changes.
    renamed = true;
    await vi.advanceTimersByTimeAsync(10);
    await invalidatePageCacheTags(
      [contentDeliverySitemapTag(POSTS.contentTypeId)],
      { mode: "hard" },
    );
    await vi.advanceTimersByTimeAsync(1);
    gate.resolve();
    await settle();

    const served: string[] = [];
    for (const wait of [0, 3_000, 0]) {
      await vi.advanceTimersByTimeAsync(wait);
      const { body, response } = await request("/sitemap-blog-1.xml");
      await settle();
      if (response.status === 200) served.push(body);
    }

    expect(first.response.status).toBe(503);
    expect(served.length).toBeGreaterThan(0);
    for (const body of served) {
      expect(locs(body)).not.toContain(`${WEB}/blog/post-1`);
      expect(locs(body)).toContain(`${WEB}/blog/renamed`);
    }
  });
});
