import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETURN_TO,
  isSafeReturnTo,
  sanitizeReturnTo,
} from "./return-to";

/**
 * The post-login redirect target, which is the one auth input any visitor can
 * put anything into. Everything here is a pure string transform, so the whole
 * rule can be stated as a table rather than exercised through a browser.
 */
describe("sanitizeReturnTo keeps application-relative paths", () => {
  it.each([
    "/",
    "/discover",
    "/pl/discover",
    "/settings",
    "/settings/security?tab=devices",
    "/settings#password",
  ])("keeps %s", target => {
    expect(sanitizeReturnTo(target)).toBe(target);
    expect(isSafeReturnTo(target)).toBe(true);
  });

  it("normalises a path rather than echoing it back unparsed", () => {
    expect(sanitizeReturnTo("/settings/../discover")).toBe("/discover");
  });
});

describe("sanitizeReturnTo rejects anything that can leave this origin", () => {
  it.each([
    // An absolute URL - the open redirect that turns a login page into a
    // phishing hop.
    "https://evil.example.com",
    "http://evil.example.com/discover",
    // Protocol-relative, and the backslash spelling of it the URL parser reads
    // the same way.
    "//evil.example.com",
    "/\\evil.example.com",
    "/\\/evil.example.com",
    // Scheme-carrying values, including the ones browsers reach by stripping
    // whitespace out of the string first.
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    // Not a path at all.
    "discover",
    "",
    "?tab=devices",
    "#password",
  ])("rejects %j", target => {
    expect(sanitizeReturnTo(target)).toBe(DEFAULT_RETURN_TO);
    expect(isSafeReturnTo(target)).toBe(false);
  });

  it.each([undefined, null, 42, {}, ["/discover"]])(
    "rejects the non-string %j",
    target => {
      expect(sanitizeReturnTo(target)).toBe(DEFAULT_RETURN_TO);
      expect(isSafeReturnTo(target)).toBe(false);
    },
  );
});

describe("sanitizeReturnTo falls back predictably", () => {
  it("uses the caller fallback when there is no target", () => {
    expect(sanitizeReturnTo(undefined, { fallback: "/discover" })).toBe(
      "/discover",
    );
  });

  it("holds the fallback to the same rule as the target", () => {
    // A fallback is code rather than input, but trusting it for that reason is
    // how one gets written as a full URL and never noticed.
    expect(
      sanitizeReturnTo("https://evil.example.com", {
        fallback: "https://also-evil.example.com",
      }),
    ).toBe(DEFAULT_RETURN_TO);
  });
});
