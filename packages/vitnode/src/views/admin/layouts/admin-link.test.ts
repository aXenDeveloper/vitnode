import { describe, expect, it } from "vitest";

import { isExternalHref } from "./normalize-url";

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
