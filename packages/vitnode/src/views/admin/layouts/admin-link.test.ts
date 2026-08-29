import { describe, expect, it } from "vitest";

import { isExternalHref } from "./normalize-url";

/**
 * Which AdminCP destinations are a router's business and which are not.
 *
 * A plugin's `admin.nav` entry may point anywhere, and an absolute URL is not a
 * path - which matters because every link component in VitNode takes a path.
 * Hand one an external URL and `next-intl` tries to localize it, TanStack Router
 * tries to match it, and `apps/web`'s `MigrationLink` asks
 * `isTanStackOwnedPath`, which reads only the pathname: `https://example.com`
 * arrives as `/`, matches the front page, and is reported as owned. The sidebar
 * entry then goes to the wrong place, silently.
 *
 * This classification is what stops that, so it is worth pinning precisely -
 * especially the two cases in the middle, which are the ones a looser rule gets
 * wrong in opposite directions.
 */
describe("isExternalHref", () => {
  it.each([
    "https://status.example.com",
    "http://example.com/page",
    "mailto:admin@example.com",
    "tel:+15551234",
    // Protocol-relative: the browser fills in the current scheme and lands on
    // another origin exactly as an absolute URL would.
    "//cdn.example.com/dashboard",
  ])("treats %s as external", href => {
    expect(isExternalHref(href)).toBe(true);
  });

  it.each([
    "/admin/core",
    "/admin/core/",
    "/admin/content/blog/posts",
    "/",
    // A relative path is still a path.
    "core/users",
  ])("treats %s as internal", href => {
    expect(isExternalHref(href)).toBe(false);
  });

  /**
   * The reason the pattern is anchored rather than a bare `includes(":")`. A
   * colon is legal deeper in a path, and a rule that saw one anywhere would
   * route a perfectly ordinary admin screen through a plain anchor - losing the
   * client-side navigation and, in the Next.js app, the locale prefix with it.
   */
  it("does not mistake a colon inside a path for a scheme", () => {
    expect(isExternalHref("/admin/core/users/a:b")).toBe(false);
    expect(isExternalHref("/admin/core/search?q=a:b")).toBe(false);
  });

  /**
   * A scheme-looking prefix must actually be at the start. `/https://x` is a
   * path on this site that happens to read like a URL.
   */
  it("requires the scheme at the start", () => {
    expect(isExternalHref("/https://example.com")).toBe(false);
  });
});
