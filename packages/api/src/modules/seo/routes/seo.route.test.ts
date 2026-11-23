import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEO_CACHE_CONTROL } from "@/lib/seo/sitemap";
import { createSeoWorld } from "@/tests/seo";

const T0 = new Date("2026-11-23T12:00:00.000Z");
const OPENS_IN_SECONDS = 600;

const OFFLINE = {
  offline: true,
  opensAt: new Date(T0.getTime() + OPENS_IN_SECONDS * 1000),
};

const read = async (
  world: Awaited<ReturnType<typeof createSeoWorld>>,
  path: string,
) => {
  const response = await world.app.request(path);

  return {
    body: await response.text(),
    cacheControl: response.headers.get("cache-control"),
    contentType: response.headers.get("content-type"),
    retryAfter: response.headers.get("retry-after"),
    status: response.status,
  };
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /robots", () => {
  it("serves the generated file as cacheable plain text", async () => {
    const response = await read(await createSeoWorld(), "/robots");

    expect(response).toMatchObject({
      cacheControl: expect.stringMatching(/^public, max-age=300/),
      contentType: "text/plain; charset=utf-8",
      status: 200,
    });
    expect(response.body).toContain("Disallow: /pl/settings\n");
    expect(response.body).toContain(
      "Sitemap: http://localhost:3000/sitemap.xml\n",
    );
  });

  it("leaves out the sitemap line when sitemaps are off", async () => {
    const { body } = await read(
      await createSeoWorld({ settings: { sitemapEnabled: false } }),
      "/robots",
    );

    expect(body).not.toContain("Sitemap:");
  });

  it("answers 503 with Retry-After and no caching while the site is offline", async () => {
    expect(
      await read(await createSeoWorld({ siteStatus: OFFLINE }), "/robots"),
    ).toMatchObject({
      body: expect.stringMatching(/^# The site is offline/),
      cacheControl: "no-store",
      retryAfter: String(OPENS_IN_SECONDS),
      status: 503,
    });
  });
});

describe("GET /sitemap and /sitemaps/{file}", () => {
  it("lists one file per page of every non-empty source, as cacheable XML", async () => {
    const response = await read(
      await createSeoWorld({
        docsSize: 150,
        settings: { sitemapMaxUrls: 100 },
      }),
      "/sitemap",
    );

    expect(response).toMatchObject({
      cacheControl: SEO_CACHE_CONTROL,
      contentType: "application/xml; charset=utf-8",
      status: 200,
    });
    expect(
      [...response.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        match => match[1],
      ),
    ).toStrictEqual([
      "http://localhost:3000/sitemaps/static-1.xml",
      "http://localhost:3000/sitemaps/docs-1.xml",
      "http://localhost:3000/sitemaps/docs-2.xml",
    ]);
  });

  it("serves the second page of a source", async () => {
    const response = await read(
      await createSeoWorld({
        docsSize: 150,
        settings: { sitemapMaxUrls: 100 },
      }),
      "/sitemaps/docs-2.xml",
    );

    expect(response.status).toBe(200);
    expect(response.body.match(/<loc>/g)).toHaveLength(50);
    expect(response.body).toContain(
      "<loc>http://localhost:3000/docs/101</loc>",
    );
  });

  it.each([
    ["indexing is off", { allowIndexing: false }, "/sitemap"],
    ["sitemaps are off", { sitemapEnabled: false }, "/sitemap"],
    ["sitemaps are off", { sitemapEnabled: false }, "/sitemaps/docs-1.xml"],
    [
      "the source is disabled",
      { disabledSitemapSources: ["docs"] },
      "/sitemaps/docs-1.xml",
    ],
    ["the page is past the end", {}, "/sitemaps/docs-2.xml"],
    ["the source is unknown", {}, "/sitemaps/nope-1.xml"],
    ["the name is not a sitemap file", {}, "/sitemaps/docs-0.xml"],
  ])("answers an uncached 404 when %s (%o, %s)", async (_, settings, path) => {
    expect(await read(await createSeoWorld({ settings }), path)).toMatchObject({
      cacheControl: "no-store",
      status: 404,
    });
  });

  it.each(["/sitemap", "/sitemaps/docs-1.xml"])(
    "answers an uncached 503 for %s while the site is offline",
    async path => {
      expect(
        await read(await createSeoWorld({ siteStatus: OFFLINE }), path),
      ).toMatchObject({ cacheControl: "no-store", status: 503 });
    },
  );
});
