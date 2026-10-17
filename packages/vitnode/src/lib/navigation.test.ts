import { describe, expect, it } from "vitest";

import { isExternalNavigationHref, isValidNavigationHref } from "./navigation";

describe("hrefs", () => {
  it.each([
    "/discover",
    "/docs/dev",
    "https://vitnode.com",
    "https://a.b/c?x=1",
  ])("accepts %s", href => {
    expect(isValidNavigationHref(href)).toBe(true);
  });

  it.each([
    "",
    " /x",
    "//evil.com",
    "javascript:alert(1)",
    "discover",
    "/a b",
    "http://vitnode.com",
    "HTTP://vitnode.com",
  ])("rejects %s", href => {
    expect(isValidNavigationHref(href)).toBe(false);
  });

  it("tells an external address from a path on this site", () => {
    expect(isExternalNavigationHref("https://vitnode.com")).toBe(true);
    expect(isExternalNavigationHref("mailto:hi@vitnode.com")).toBe(true);
    expect(isExternalNavigationHref("//cdn.example")).toBe(true);
    expect(isExternalNavigationHref("/discover")).toBe(false);
  });
});
