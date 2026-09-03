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
