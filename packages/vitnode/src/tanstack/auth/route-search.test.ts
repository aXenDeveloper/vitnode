import { describe, expect, it } from "vitest";

import { parseSsoCallback } from "./contract";
import { sanitizeReturnTo } from "./return-to";
import {
  normalizeLoginSearch,
  normalizeSsoCallbackSearch,
} from "./route-search";

/**
 * The two auth search contracts, as the router actually hands them over.
 *
 * TanStack parses each query value with `JSON.parse` before `validateSearch`
 * sees it, so the inputs below are the *parsed* shapes - `?state=48291` arrives
 * as the number `48291`, not the string. That single fact is what these
 * normalisers exist for, and what the schemas they replaced got wrong.
 */
describe("normalizeLoginSearch", () => {
  it("keeps a target as it arrived, byte for byte", () => {
    // Not re-encoded and not resolved: the value has to survive a round trip
    // through the stringifier, or the server's canonical-location check answers
    // a 307 to a differently-spelled URL.
    expect(
      normalizeLoginSearch({ returnTo: "/settings/security?tab=1" }),
    ).toEqual({ returnTo: "/settings/security?tab=1" });
  });

  it("drops a value that cannot be a target, as an absent key", () => {
    // An absent key rather than `returnTo: undefined`, so the router has nothing
    // to write back and the URL settles to a clean `/login`.
    for (const returnTo of [123, "", null, true, {}, []]) {
      expect(normalizeLoginSearch({ returnTo })).not.toHaveProperty("returnTo");
    }
  });

  it("does not reject a crafted target - it keeps it for sanitizeReturnTo", () => {
    // The whole reason this is a normaliser. Rejecting here would render the
    // error boundary instead of the login form, and the form is the page a
    // visitor following a tampered link can still use.
    const search = normalizeLoginSearch({
      returnTo: "https://evil.example.com",
    });

    expect(search.returnTo).toBe("https://evil.example.com");
    // ...and the value is refused where it is actually used.
    expect(sanitizeReturnTo(search.returnTo)).toBe("/");
  });

  it("ignores everything else in the query", () => {
    expect(
      normalizeLoginSearch({ returnTo: "/files", utm_source: "x" }),
    ).toEqual({ returnTo: "/files" });
  });

  it("answers an empty object for an empty query", () => {
    expect(normalizeLoginSearch({})).toEqual({});
  });
});

describe("normalizeSsoCallbackSearch", () => {
  it("keeps the approval half", () => {
    expect(normalizeSsoCallbackSearch({ code: "abc", state: "xyz" })).toEqual({
      code: "abc",
      state: "xyz",
    });
  });

  it("keeps the denial half", () => {
    expect(normalizeSsoCallbackSearch({ error: "access_denied" })).toEqual({
      error: "access_denied",
    });
  });

  it("keeps both when a provider sends both", () => {
    // OAuth allows it, and `parseSsoCallback` prefers the error.
    expect(
      normalizeSsoCallbackSearch({ code: "abc", error: "consent_required" }),
    ).toEqual({ code: "abc", error: "consent_required" });
  });

  it("drops an all-digit state rather than failing the route", () => {
    // The regression this replaced a zod schema to fix: `?state=48291` reaches
    // `validateSearch` as a number, `z.string()` throws, and the callback route
    // renders its error boundary in the middle of a sign-in the visitor already
    // approved. Dropping it means `parseSsoCallback` answers `invalid_callback`
    // and the visitor gets the "try again" screen - a page, not a crash.
    expect(normalizeSsoCallbackSearch({ code: "abc", state: 48291 })).toEqual({
      code: "abc",
    });
  });

  it("hands parseSsoCallback something it can classify, whatever arrived", () => {
    const cases: Record<string, unknown>[] = [
      {},
      { error: "access_denied" },
      { code: 1, state: 2 },
      { code: "abc", state: "xyz" },
      { code: null, error: "", state: undefined },
    ];

    for (const query of cases) {
      const parsed = parseSsoCallback({
        providerId: "google",
        query: normalizeSsoCallbackSearch(query),
      });

      // A closed union every time - never a throw, which is the property the
      // route depends on.
      expect(typeof parsed.ok).toBe("boolean");
    }
  });

  it("answers an empty object for an empty query", () => {
    expect(normalizeSsoCallbackSearch({})).toEqual({});
  });
});
