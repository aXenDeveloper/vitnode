import { afterEach, describe, expect, it, vi } from "vitest";

import { buildConfig } from "@/vitnode.config";

import {
  absoluteImageUrl,
  createRouteHead,
  generatedOgImage,
  pageHead,
  routeHead,
} from "./index";

const METADATA = { shortTitle: "VitNode", title: "VitNode Community" };

const head = (options?: Parameters<typeof routeHead>[1]) =>
  routeHead(METADATA, options).meta;

/** The tag with this `name`, or `undefined`. */
const byName = (meta: ReturnType<typeof head>, name: string) =>
  meta.find(tag => "name" in tag && tag.name === name);

/** The tag with this `property`, or `undefined`. */
const byProperty = (meta: ReturnType<typeof head>, property: string) =>
  meta.find(tag => "property" in tag && tag.property === property);

/** The document title entry, or `undefined`. */
const titleOf = (meta: ReturnType<typeof head>) =>
  meta.find(tag => "title" in tag);

describe("routeHead", () => {
  it("emits nothing at all for a route that declares nothing", () => {
    // The first pass of every route with a loader: `head` runs before
    // `loaderData` exists, so it is called with nothing and must produce
    // nothing rather than a tag full of `undefined`.
    expect(head()).toEqual([]);
    expect(head({})).toEqual([]);
  });

  it("formats a title as `<page> - <site>`", () => {
    expect(titleOf(head({ title: "Discover" }))).toEqual({
      title: "Discover - VitNode",
    });
  });

  it("falls back to the full site name when there is no short one", () => {
    expect(
      routeHead({ title: "VitNode Community" }, { title: "Discover" }),
    ).toEqual({ meta: [{ title: "Discover - VitNode Community" }] });
  });

  it("emits a description on its own", () => {
    expect(head({ description: "Everything, indexed" })).toEqual([
      { content: "Everything, indexed", name: "description" },
    ]);
  });

  it("emits a robots directive on its own", () => {
    expect(head({ robots: "noindex, nofollow" })).toEqual([
      { content: "noindex, nofollow", name: "robots" },
    ]);
  });

  it("omits an empty string as readily as an absent value", () => {
    // A loader that resolved a page with no description hands over `""`, and an
    // empty `<meta name="description">` is worse than none.
    expect(head({ description: "", robots: undefined, title: "" })).toEqual([]);
  });
});

describe("routeHead openGraph", () => {
  const FULL = {
    description: "Adding routes to the Hono API from a plugin",
    openGraph: {
      description: "Adding routes to the Hono API from a plugin",
      title: "Routes - Plugins",
      type: "article" as const,
    },
    robots: "index, follow" as const,
    title: "Routes - Plugins",
  };

  it("emits og:title, og:description and og:type", () => {
    const meta = head(FULL);

    expect(byProperty(meta, "og:title")).toEqual({
      content: "Routes - Plugins",
      property: "og:title",
    });
    expect(byProperty(meta, "og:description")).toEqual({
      content: "Adding routes to the Hono API from a plugin",
      property: "og:description",
    });
    expect(byProperty(meta, "og:type")).toEqual({
      content: "article",
      property: "og:type",
    });
  });

  it("leaves og:title un-templated while the document title is templated", () => {
    const meta = head(FULL);

    expect(titleOf(meta)).toEqual({ title: "Routes - Plugins - VitNode" });
    expect(byProperty(meta, "og:title")).toMatchObject({
      content: "Routes - Plugins",
    });
  });

  it("uses property rather than name, which is what a crawler reads", () => {
    for (const tag of head(FULL).filter(one => "property" in one)) {
      expect(tag).not.toHaveProperty("name");
    }
    expect(byName(head(FULL), "og:title")).toBeUndefined();
  });

  it.each([
    ["title", { title: "Routes" }, "og:title"],
    ["description", { description: "A page" }, "og:description"],
    ["type", { type: "website" as const }, "og:type"],
  ])("emits og:%s on its own", (_field, openGraph, property) => {
    const meta = head({ openGraph });

    expect(meta).toHaveLength(1);
    expect(byProperty(meta, property)).toBeDefined();
  });

  it("omits every undefined Open Graph field", () => {
    expect(head({ openGraph: {} })).toEqual([]);
    expect(
      head({
        openGraph: {
          description: undefined,
          title: undefined,
          type: undefined,
        },
      }),
    ).toEqual([]);
  });
});

describe("routeHead openGraph image", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits the generated image with its size, type and alt, and a large Twitter card", () => {
    const meta = head({
      openGraph: {
        image: generatedOgImage({
          alt: "Hello world",
          url: "https://cdn.example/og/42.png",
        }),
      },
    });

    expect(meta).toEqual([
      { content: "https://cdn.example/og/42.png", property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      { content: "image/png", property: "og:image:type" },
      { content: "Hello world", property: "og:image:alt" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: "https://cdn.example/og/42.png", name: "twitter:image" },
      { content: "Hello world", name: "twitter:image:alt" },
    ]);
  });

  it("resolves a root-relative image against the public site origin", () => {
    vi.stubEnv("VITNODE_WEB_URL", "https://community.example");

    const meta = head({
      openGraph: { image: { url: "/api/@vitnode/blog/og-image/42?v=abc" } },
    });

    expect(byProperty(meta, "og:image")).toEqual({
      content: "https://community.example/api/@vitnode/blog/og-image/42?v=abc",
      property: "og:image",
    });
    expect(byName(meta, "twitter:image")).toMatchObject({
      content: "https://community.example/api/@vitnode/blog/og-image/42?v=abc",
    });
  });

  it("omits a size that is not a positive integer and a blank alt", () => {
    const meta = head({
      openGraph: {
        image: {
          alt: "  ",
          height: 1.5,
          url: "https://cdn.example/a.png",
          width: 0,
        },
      },
    });

    expect(meta).toEqual([
      { content: "https://cdn.example/a.png", property: "og:image" },
      { content: "summary_large_image", name: "twitter:card" },
      { content: "https://cdn.example/a.png", name: "twitter:image" },
    ]);
  });

  it.each([
    ["a script URL", "javascript:alert(1)"],
    ["a data URI", "data:image/png;base64,AAAA"],
    ["a protocol-relative URL", "//evil.example/a.png"],
    ["a relative path", "og/a.png"],
  ])("emits no image or Twitter tag for %s", (_label, url) => {
    const meta = head({ openGraph: { image: { url }, title: "Hello" } });

    expect(meta).toEqual([{ content: "Hello", property: "og:title" }]);
  });
});

describe("absoluteImageUrl", () => {
  it.each([
    ["https://cdn.example/a.png", "https://cdn.example/a.png"],
    ["http://cdn.example/a.png", "http://cdn.example/a.png"],
    ["/api/og/1", "https://site.example/api/og/1"],
    ["//evil.example/a.png", undefined],
    ["/\\evil.example/a.png", undefined],
    ["ftp://files.example/a.png", undefined],
    ["not a url", undefined],
  ])("turns %j into %j", (url, expected) => {
    expect(absoluteImageUrl(url, "https://site.example")).toBe(expected);
  });
});

describe("createRouteHead", () => {
  it("binds the site name once so a route never restates it", () => {
    const pageHead = createRouteHead(METADATA);

    expect(pageHead({ title: "Discover" })).toEqual({
      meta: [{ title: "Discover - VitNode" }],
    });
    expect(pageHead()).toEqual({ meta: [] });
  });

  it("passes Open Graph through unchanged", () => {
    const pageHead = createRouteHead(METADATA);

    expect(pageHead({ openGraph: { type: "article" } })).toEqual({
      meta: [{ content: "article", property: "og:type" }],
    });
  });
});

describe("pageHead", () => {
  it("titles a page with the site the application registered", () => {
    buildConfig({
      i18n: { defaultLocale: "en", locales: [{ code: "en", name: "English" }] },
      metadata: METADATA,
      plugins: [],
    });

    expect(titleOf(pageHead({ title: "Welcome" }).meta)).toEqual({
      title: "Welcome - VitNode",
    });
  });

  it("reads the config on every call rather than binding it once", () => {
    buildConfig({
      i18n: { defaultLocale: "en", locales: [{ code: "en", name: "English" }] },
      metadata: { shortTitle: "Renamed", title: "Renamed Community" },
      plugins: [],
    });

    expect(titleOf(pageHead({ title: "Welcome" }).meta)).toEqual({
      title: "Welcome - Renamed",
    });
  });
});
