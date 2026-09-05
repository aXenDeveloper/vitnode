// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createRouteHead, routeHead } from "./index";

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

  it("never infers Open Graph from the page title or description", () => {
    // Deliberate: `og:title` is not the document title, so defaulting one to
    // the other would publish the wrong string to every site that unfurls a
    // link. A route says what it means.
    const meta = head({ description: "A page", title: "Routes" });

    expect(byProperty(meta, "og:title")).toBeUndefined();
    expect(byProperty(meta, "og:description")).toBeUndefined();
    expect(byProperty(meta, "og:type")).toBeUndefined();
  });

  it("adds no image, canonical URL or Twitter card", () => {
    const emitted = head(FULL).flatMap(tag =>
      "property" in tag ? [tag.property] : "name" in tag ? [tag.name] : [],
    );

    expect(emitted.filter(one => one?.startsWith("twitter:"))).toEqual([]);
    expect(emitted).not.toContain("og:image");
    expect(emitted).not.toContain("og:url");
    expect(emitted).not.toContain("og:site_name");
  });

  it("keeps the whole head in one array, robots first and og last", () => {
    // The order is not load-bearing for correctness - TanStack keys tags by
    // `name ?? property` - but a stable shape is what makes the assertions
    // above readable, and a reordering is worth noticing.
    expect(head(FULL)).toEqual([
      { content: "index, follow", name: "robots" },
      { title: "Routes - Plugins - VitNode" },
      {
        content: "Adding routes to the Hono API from a plugin",
        name: "description",
      },
      { content: "Routes - Plugins", property: "og:title" },
      {
        content: "Adding routes to the Hono API from a plugin",
        property: "og:description",
      },
      { content: "article", property: "og:type" },
    ]);
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
