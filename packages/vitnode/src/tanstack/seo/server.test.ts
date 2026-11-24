import type { LocaleConfig } from "@vitnode/api/lib/i18n/types";

import { CONTENT_REVALIDATE_PATH } from "@vitnode/api/content/server/revalidate-bridge";
import { resetPageCacheStore } from "@vitnode/api/page-cache/store.server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VitNodeConfig } from "@/vitnode.config";

import type { SeoContentSitemapFetch } from "./content-transport.server";
import type { VitNodeSeoConfig } from "./types";

import { createSeoSitemapCache } from "./cache.server";
import { createSeoHandler } from "./server";

const WEB = "https://example.com";

const I18N: VitNodeConfig["i18n"] = {
  defaultLocale: "en",
  domains: [
    { defaultLocale: "en", origin: WEB },
    { defaultLocale: "pl", origin: "https://example.pl" },
  ],
  locales: [
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ] satisfies LocaleConfig[],
};

const HTML = "<!doctype html><html><head><title>Hi</title></head></html>";

const setup = (seo?: VitNodeSeoConfig) => {
  const render = vi.fn(async (request: Request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/data.json") {
      return await Promise.resolve(Response.json({ ok: true }));
    }

    return await Promise.resolve(
      new Response(HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
  });
  const fetchPage: SeoContentSitemapFetch = async () =>
    await Promise.reject(new Error("No content source in this test."));
  const handler = createSeoHandler(
    render,
    {
      config: {
        config: { i18n: I18N, metadata: { title: "Test" }, plugins: [] },
        ...(seo === undefined ? {} : { seo }),
      },
      sitemap: { revision: "test", sources: [] },
    },
    { cache: createSeoSitemapCache("memory"), fetchPage, webOrigin: WEB },
  );

  const request = async (url: string, init: RequestInit = {}) => {
    const response = await handler(new Request(new URL(url, WEB), init));

    return { body: await response.text(), response };
  };

  return { render, request };
};

beforeEach(() => {
  resetPageCacheStore();
});

afterEach(() => {
  resetPageCacheStore();
});

describe("seo left out", () => {
  it.each<[string, RequestInit]>([
    ["/robots.txt", {}],
    ["/sitemap.xml", {}],
    ["/sitemap-pages-1.xml", {}],
    ["/blog", {}],
    [CONTENT_REVALIDATE_PATH, { body: "{}", method: "POST" }],
  ])("passes %s through untouched", async (path, init) => {
    const { render, request } = setup();

    const { body, response } = await request(path, init);

    expect(render).toHaveBeenCalledTimes(1);
    expect(body).toBe(HTML);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("/robots.txt", () => {
  it("is plain text generated without rendering the app", async () => {
    const { render, request } = setup({ indexing: true });

    const { body, response } = await request("/robots.txt");

    expect(render).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("content-length")).toBe(
      String(new TextEncoder().encode(body).byteLength),
    );
    expect(body).toContain("User-agent: *");
  });

  it("answers HEAD with the headers and no body", async () => {
    const { request } = setup({ indexing: true });

    const { body, response } = await request("/robots.txt", {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    expect(body).toBe("");
  });

  it.each<[string, string]>([
    [`${WEB}/robots.txt`, `${WEB}/sitemap.xml`],
    // Any other Host - spoofed, a preview alias - never becomes a URL.
    ["https://evil.test/robots.txt", `${WEB}/sitemap.xml`],
    ["http://localhost:3000/robots.txt", `${WEB}/sitemap.xml`],
    // A configured locale domain gets its own origin.
    ["https://example.pl/robots.txt", "https://example.pl/sitemap.xml"],
  ])("%s lists %s", async (url, sitemap) => {
    const { request } = setup({ indexing: true });

    const { body } = await request(url);

    expect(body.match(/^Sitemap: .*$/gm)).toEqual([`Sitemap: ${sitemap}`]);
  });

  it("excludes only the locales a domain serves", async () => {
    const { request } = setup({ indexing: true });

    const [main, pl] = await Promise.all([
      request(`${WEB}/robots.txt`),
      request("https://example.pl/robots.txt"),
    ]);

    expect(main.body.match(/^Disallow: .*$/gm)).toEqual([
      "Disallow: /admin",
      "Disallow: /settings",
    ]);
    expect(pl.body.match(/^Disallow: .*$/gm)).toEqual([
      "Disallow: /admin",
      "Disallow: /settings",
    ]);
  });
});

describe("indexing: false", () => {
  it("adds X-Robots-Tag to HTML only", async () => {
    const { request } = setup({ indexing: false });

    const [page, data] = await Promise.all([
      request("/blog"),
      request("/data.json"),
    ]);

    expect(page.response.headers.get("x-robots-tag")).toBe("noindex");
    expect(page.body).toBe(HTML);
    expect(data.response.headers.get("x-robots-tag")).toBeNull();
  });

  it("writes a robots meta into a prerendered page", async () => {
    const { request } = setup({ indexing: false });

    const { body, response } = await request("/blog", {
      headers: { "x-nitro-prerender": "/blog" },
    });

    expect(body).toContain('<head><meta name="robots" content="noindex"/>');
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("leaves pages alone while indexing is on", async () => {
    const { request } = setup({ indexing: true });

    const { body, response } = await request("/blog", {
      headers: { "x-nitro-prerender": "/blog" },
    });

    expect(body).toBe(HTML);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("sitemap turned off", () => {
  it.each<[string, VitNodeSeoConfig]>([
    ["indexing off", { indexing: false, sitemap: { paths: ["/"] } }],
    [
      "sitemap.enabled false",
      { indexing: true, sitemap: { enabled: false, paths: ["/"] } },
    ],
  ])("answers 404 for every sitemap URL with %s", async (_, seo) => {
    const { render, request } = setup(seo);

    for (const path of ["/sitemap.xml", "/sitemap-pages-1.xml"]) {
      const { response } = await request(path);

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(render).not.toHaveBeenCalled();
  });
});
