import { describe, expect, it } from "vitest";

import {
  HEADER_HREF,
  HEADER_NAV_MESSAGE_KEYS,
  headerNavItems,
} from "./header-nav";

/**
 * The main nav, as the two frameworks build it.
 *
 * `headerNavItems` is the whole of what they share: a label from a translator
 * each resolves in its own way, paired with an href neither is allowed to spell
 * itself. What is pinned here is that pairing - the destinations, the order, and
 * that the hrefs stay internal - because a difference in any of the three is a
 * header that looks migrated and navigates somewhere else.
 */
describe("the main nav", () => {
  const labels = { discover: "Discover", search: "Search" };

  it("is Discover then Search", () => {
    expect(headerNavItems(labels)).toEqual([
      { href: "/discover", label: "Discover" },
      { href: "/search", label: "Search" },
    ]);
  });

  it("carries the label it was given, untouched", () => {
    // Both frameworks translate `core.search.nav.*`, so a nav rendered in
    // Polish is Polish because of what was passed in and nothing else - there is
    // no fallback string in here to mask a namespace nobody warmed.
    expect(headerNavItems({ discover: "Odkrywaj", search: "Szukaj" })).toEqual([
      { href: "/discover", label: "Odkrywaj" },
      { href: "/search", label: "Szukaj" },
    ]);
  });

  it("points at internal paths with no locale prefix", () => {
    // The prefix is the router's to write - `rewrite.output` in `apps/web`, the
    // locale-aware `Link` in Next.js. A prefix here would be a second one.
    for (const { href } of headerNavItems(labels)) {
      expect(href.startsWith("/")).toBe(true);
      expect(href).not.toMatch(/^\/(en|pl)\b/);
    }
  });

  it("gives every link a distinct key", () => {
    // `href` is the React key, so a duplicate is a silently dropped link.
    const hrefs = headerNavItems(labels).map(item => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

/**
 * The logo, which is not in the nav list and is still the same destination in
 * both frameworks.
 */
describe("the header's destinations", () => {
  it("sends the logo home", () => {
    expect(HEADER_HREF.home).toBe("/");
  });

  it("reads its labels from the namespace that already owns them", () => {
    // `core.search.nav.*`, where the Next.js header has always read them.
    // Shared as literals so a typed translator still checks them at each call
    // site - the two translator *types* are not interchangeable.
    expect(HEADER_NAV_MESSAGE_KEYS).toEqual({
      discover: "nav.discover",
      search: "nav.search",
    });
  });
});
