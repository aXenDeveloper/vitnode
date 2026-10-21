import { describe, expect, it } from "vitest";

import { normalizePluginRouteHead } from "./head";

describe("normalizePluginRouteHead", () => {
  it("keeps the three fields a plugin page may set", () => {
    expect(
      normalizePluginRouteHead({
        description: "Everything about routing.",
        robots: "index, follow",
        title: "Guide",
      }),
    ).toEqual({
      description: "Everything about routing.",
      robots: "index, follow",
      title: "Guide",
    });
  });

  it("omits what a page did not set, so a parent's head still wins", () => {
    expect(normalizePluginRouteHead({ title: "Guide" })).toEqual({
      title: "Guide",
    });
  });

  /**
   * The one field checked by value rather than by type: an unknown directive
   * reaches `<meta name="robots">` and tells a crawler something nobody meant.
   */
  it.each([
    ["an unknown directive", "index"],
    ["a boolean", true],
    ["an empty string", ""],
  ])("drops a robots value that is %s", (_label, robots) => {
    expect(normalizePluginRouteHead({ robots, title: "Guide" })).toEqual({
      title: "Guide",
    });
  });

  it("drops a title or description that is not a non-empty string", () => {
    expect(normalizePluginRouteHead({ description: 42, title: "" })).toEqual(
      {},
    );
  });

  it("drops anything the contract does not name", () => {
    expect(
      normalizePluginRouteHead({
        links: [{ href: "https://example.invalid", rel: "canonical" }],
        scripts: [{ src: "https://example.invalid/x.js" }],
        title: "Guide",
      }),
    ).toEqual({ title: "Guide" });
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["a string", "Guide"],
    ["an array", []],
  ])("answers %s with no metadata rather than throwing", (_label, declared) => {
    expect(normalizePluginRouteHead(declared)).toEqual({});
  });
});

describe("normalizePluginRouteHead alternates", () => {
  it("keeps per-locale internal pathnames", () => {
    expect(
      normalizePluginRouteHead({
        alternates: { en: "/articles/hello", pl: "/articles/witaj" },
      }),
    ).toEqual({
      alternates: { en: "/articles/hello", pl: "/articles/witaj" },
    });
  });

  it("drops entries that are not internal pathnames", () => {
    expect(
      normalizePluginRouteHead({
        alternates: {
          de: "//evil.example",
          en: "/articles/hello",
          fr: 42,
          pl: "https://evil.example/x",
        },
      }),
    ).toEqual({ alternates: { en: "/articles/hello" } });
  });

  it.each([
    ["an array", ["/articles/hello"]],
    ["a string", "/articles/hello"],
    ["an object with nothing usable", { en: "" }],
  ])("drops alternates that are %s", (_label, alternates) => {
    expect(normalizePluginRouteHead({ alternates })).toEqual({});
  });
});

describe("normalizePluginRouteHead openGraph", () => {
  it("keeps a valid Open Graph block with its image", () => {
    const openGraph = {
      description: "A summary",
      image: {
        alt: "Hello",
        height: 630,
        type: "image/png",
        url: "/api/@vitnode/blog/og-image/42",
        width: 1200,
      },
      title: "Hello",
      type: "article",
    };

    expect(normalizePluginRouteHead({ openGraph })).toEqual({ openGraph });
  });

  it("drops image fields of the wrong shape but keeps its URL", () => {
    expect(
      normalizePluginRouteHead({
        openGraph: {
          image: { alt: 1, height: -1, type: "", url: "/og.png", width: 1.5 },
        },
      }),
    ).toEqual({ openGraph: { image: { url: "/og.png" } } });
  });

  it.each([
    ["an image without a URL", { image: { alt: "Hello" } }],
    ["an image that is a string", { image: "/og.png" }],
    ["an unknown type", { type: "video" }],
    ["empty text", { description: "", title: "" }],
  ])("drops Open Graph with only %s", (_label, openGraph) => {
    expect(normalizePluginRouteHead({ openGraph, title: "Guide" })).toEqual({
      title: "Guide",
    });
  });
});
