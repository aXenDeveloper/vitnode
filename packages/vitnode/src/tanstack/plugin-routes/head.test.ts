import { describe, expect, it } from "vitest";

import { normalizePluginRouteHead } from "./head";

/**
 * A plugin's declared metadata, on its way into the host's own `head` rule.
 *
 * The point of this function is that a plugin's `head` is a function from a
 * compiled package run inside the host's document, so what comes back is read
 * field by field rather than spread - and that it is total, because `head` runs
 * inside the router's own try/catch and throwing there loses the tab title and
 * prints a stack instead.
 */
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

  /**
   * A plugin may not put arbitrary elements in its host's document - which is
   * the difference between this contract and re-exporting the router's own head
   * options.
   */
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
