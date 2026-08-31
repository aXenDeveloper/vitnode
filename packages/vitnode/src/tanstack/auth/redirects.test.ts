import { describe, expect, it } from "vitest";

import {
  LOGIN_PATH,
  parseInternalDestination,
  postAuthDestination,
  returnToFor,
} from "./redirects";

/**
 * Where the auth flow sends people.
 *
 * Two directions, both pure string transforms, so the whole policy is a table:
 * what a blocked visitor carries to the login page, and where a signed-in one is
 * sent from it. The safety half - which targets are acceptable at all - is
 * `auth-return-to.test.ts`; these are the decisions layered on top of it.
 */

describe("postAuthDestination", () => {
  it.each([
    ["/discover", "/discover"],
    ["/settings/security?tab=devices", "/settings/security?tab=devices"],
    ["/pl/discover", "/pl/discover"],
    ["/discover#results", "/discover#results"],
  ])("keeps the application path %s", (input, expected) => {
    expect(postAuthDestination(input)).toBe(expected);
  });

  it.each([
    ["no target at all", undefined],
    ["a target that is not a string", 42],
    ["an absolute URL", "https://evil.example.com/"],
    ["a protocol-relative URL", "//evil.example.com/"],
    ["a script URL", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["a backslash-disguised host", "/\\evil.example.com"],
    ["a newline-split scheme", "/\njavascript:alert(1)"],
  ])("falls back to the front page for %s", (_why, input) => {
    expect(postAuthDestination(input)).toBe("/");
  });

  /**
   * The loop guard. Without it, `/login?returnTo=/login` sends a signed-in
   * visitor to the login page, whose guard sends them to the login page.
   */
  it.each([
    LOGIN_PATH,
    `${LOGIN_PATH}?returnTo=/discover`,
    `${LOGIN_PATH}/reset-password`,
    `${LOGIN_PATH}/sso/google?code=abc`,
  ])("refuses to send a signed-in visitor back to %s", input => {
    expect(postAuthDestination(input)).toBe("/");
  });

  it("does not treat a path that merely starts with the same letters as the login page", () => {
    expect(postAuthDestination("/logins")).toBe("/logins");
    expect(postAuthDestination("/login-help")).toBe("/login-help");
  });
});

describe("returnToFor", () => {
  it("carries the internal path, its query and its hash", () => {
    expect(
      returnToFor({
        hash: "devices",
        pathname: "/settings/security",
        searchStr: "?tab=devices",
      }),
    ).toBe("/settings/security?tab=devices#devices");
  });

  it("accepts a hash that already carries its own #", () => {
    expect(returnToFor({ hash: "#devices", pathname: "/settings" })).toBe(
      "/settings#devices",
    );
  });

  /**
   * The locale is deliberately absent. `location.pathname` is what the route
   * tree matched - the rewrite has already stripped `/pl` - so the value that
   * round-trips through the login URL carries no language and the prefix is
   * written back exactly once, by the rewrite, when the router builds the way
   * home.
   */
  it("carries no locale prefix, because the internal path has none", () => {
    expect(returnToFor({ pathname: "/settings" })).toBe("/settings");
    expect(returnToFor({ pathname: "/settings" })).not.toContain("/pl");
  });

  it.each([
    ["the front page, which is the default anyway", "/"],
    ["the login page itself", LOGIN_PATH],
    ["a page under the login page", `${LOGIN_PATH}/sso/google`],
  ])("attaches nothing for %s", (_why, pathname) => {
    expect(returnToFor({ pathname })).toBeUndefined();
  });
});

describe("parseInternalDestination", () => {
  /**
   * Split rather than handed over as one `href`, because a redirect carrying
   * `href` is used verbatim by `Router.resolveRedirect` - it never reaches
   * `buildLocation`, so it never runs the locale rewrite, and a Polish visitor
   * would land on the English page.
   */
  it("splits a path into the fields a router navigation takes", () => {
    expect(
      parseInternalDestination("/settings/security?tab=devices#top"),
    ).toEqual({
      hash: "top",
      search: { tab: "devices" },
      to: "/settings/security",
    });
  });

  it("omits the parts that are not there, rather than sending empty ones", () => {
    expect(parseInternalDestination("/discover")).toEqual({ to: "/discover" });
  });

  it("leaves a locale prefix in the path for the rewrite to normalise", () => {
    expect(parseInternalDestination("/pl/discover").to).toBe("/pl/discover");
  });
});
