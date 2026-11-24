import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SeoContentSitemapSource } from "./manifest";

import {
  createContentSitemapFetch,
  readContentSitemapPage,
  SeoSitemapSourceError,
} from "./content-transport.server";

const SOURCE: SeoContentSitemapSource = {
  contentTypeId: "blog.post",
  file: "blog",
  localized: true,
  module: "content/blog",
  path: "/delivery/sitemap",
  pluginId: "@vitnode/blog",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

beforeEach(() => {
  // A non-2xx answer is logged by the shared fetch core.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createContentSitemapFetch", () => {
  it("asks the delivery route as a guest and returns the cursor opaque", async () => {
    const sent: Request[] = [];
    const fetchPage = createContentSitemapFetch({
      localTransport: async request => {
        sent.push(request);

        return await Promise.resolve(
          json({
            entries: [{ path: "/blog/hello" }],
            nextCursor: 1000,
          }),
        );
      },
    });

    const page = await fetchPage({
      cursor: "opaque:500",
      limit: 1000,
      locale: "pl",
      source: SOURCE,
    });

    expect(page.nextCursor).toBe("1000");
    expect(sent).toHaveLength(1);
    const [request] = sent;
    const url = new URL(request.url);
    expect(request.method).toBe("GET");
    expect(url.pathname).toBe(
      "/api/@vitnode/blog/content/blog/delivery/sitemap",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cursor: "opaque:500",
      limit: "1000",
      locale: "pl",
    });
    expect(request.headers.get("cookie")).toBeNull();
    expect(request.headers.get("authorization")).toBeNull();
    expect(request.headers.get("x-forwarded-for")).toBeNull();
  });

  it("leaves out the cursor and locale of a first page of an unlocalized type", async () => {
    const urls: URL[] = [];
    const fetchPage = createContentSitemapFetch({
      localTransport: async request => {
        urls.push(new URL(request.url));

        return await Promise.resolve(json({ entries: [], nextCursor: null }));
      },
    });

    await expect(
      fetchPage({ cursor: null, limit: 1000, locale: null, source: SOURCE }),
    ).resolves.toEqual({ entries: [], nextCursor: null });
    expect(urls.map(url => Object.fromEntries(url.searchParams))).toEqual([
      { limit: "1000" },
    ]);
  });

  it.each<[string, Response]>([
    ["a 404", json({ entries: [], nextCursor: null }, 404)],
    ["a 503", new Response("down", { status: 503 })],
    ["a body that is not a page", json({ items: [] })],
  ])("throws on %s", async (_, response) => {
    const fetchPage = createContentSitemapFetch({
      localTransport: async () => await Promise.resolve(response),
    });

    await expect(
      fetchPage({ cursor: null, limit: 1000, locale: null, source: SOURCE }),
    ).rejects.toBeInstanceOf(SeoSitemapSourceError);
  });
});

describe("readContentSitemapPage", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["an array", []],
    ["no entries", { nextCursor: null }],
    ["an object cursor", { entries: [], nextCursor: { id: 1 } }],
    ["a missing cursor", { entries: [] }],
    ["an entry without a path", { entries: [{ loc: "/x" }], nextCursor: null }],
  ])("rejects %s", (_, body) => {
    expect(() => readContentSitemapPage(body, "blog")).toThrow(
      SeoSitemapSourceError,
    );
  });

  it("keeps valid optional fields and drops invalid ones", () => {
    expect(
      readContentSitemapPage(
        {
          entries: [
            {
              changeFrequency: "weekly",
              lastModified: "2026-01-02T03:04:05.000Z",
              origin: "https://example.pl",
              path: "/a",
              priority: 0.5,
            },
            {
              changeFrequency: "sometimes",
              lastModified: "not a date",
              origin: 7,
              path: "/b",
              priority: 2,
            },
          ],
          nextCursor: "next",
        },
        "blog",
      ),
    ).toEqual({
      entries: [
        {
          changeFrequency: "weekly",
          lastModified: new Date("2026-01-02T03:04:05.000Z"),
          origin: "https://example.pl",
          path: "/a",
          priority: 0.5,
        },
        {
          changeFrequency: null,
          lastModified: null,
          path: "/b",
          priority: null,
        },
      ],
      nextCursor: "next",
    });
  });
});
