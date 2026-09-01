import { describe, expect, it } from "vitest";

import { parseRecoveryLink } from "./recovery-link";

/** What the API actually puts in the email: 32 random bytes as base64url. */
const TOKEN = "PSyRy0nQ0hRnfx3iCYldQ40mBLU9lqfDWtvNhrTsJI4";

describe("parsing a recovery link", () => {
  it("accepts what the reset email builds", () => {
    expect(parseRecoveryLink({ token: TOKEN, userId: "123" })).toEqual({
      token: TOKEN,
      userId: 123,
    });
  });

  it("accepts a userId that is already a number", () => {
    // A TanStack Start route's `validateSearch` may well have coerced it before
    // this sees it; the Next.js view hands over the raw string.
    expect(parseRecoveryLink({ token: TOKEN, userId: 123 })).toEqual({
      token: TOKEN,
      userId: 123,
    });
  });

  it.each([
    ["nothing at all", {}],
    ["a token with no account", { token: TOKEN }],
    ["an account with no token", { userId: "123" }],
  ])("answers null for %s, so the request form is shown", (_case, input) => {
    expect(parseRecoveryLink(input)).toBeNull();
  });

  it.each([
    ["an empty userId", ""],
    ["a zero userId", "0"],
    ["a negative userId", "-1"],
    ["a fractional userId", "1.5"],
    ["a signed userId", "+1"],
    ["a padded userId", " 1"],
    ["an exponent", "1e3"],
    ["hexadecimal", "0x10"],
    ["a word", "abc"],
    ["a boolean", true],
    ["a list", ["1", "2"]],
    ["null", null],
    ["past the safe integer range", "9007199254740993"],
  ])("rejects %s rather than coercing it", (_case, userId) => {
    // `Number("")` is 0 and `Number(true)` is 1, which is exactly why the digits
    // are checked before the coercion rather than after.
    expect(parseRecoveryLink({ token: TOKEN, userId })).toBeNull();
  });

  it.each([
    ["an empty token", ""],
    ["a whitespace token", "   "],
    ["a token that is too short to be one", "abc"],
    ["a path traversal attempt", `../../${TOKEN}`],
    ["a token carrying a newline", `${TOKEN}\n`],
    ["a token carrying a space", `${TOKEN} x`],
    ["a token with a percent escape", `${TOKEN}%2F`],
    ["an unbounded token", "a".repeat(513)],
    ["a non-string token", 123],
  ])("rejects %s", (_case, token) => {
    expect(parseRecoveryLink({ token, userId: "123" })).toBeNull();
  });

  /**
   * The same rejections, for a `userId` that arrives as a **number**.
   *
   * Which is the ordinary case on TanStack Start: the router's default search
   * parsing is `JSON.parse` per value, so `?userId=1.5` reaches this as `1.5`
   * and never as `"1.5"` - it does not go through the digit pattern at all, and
   * the integer, sign and range checks after the coercion are what stop it.
   */
  it.each([
    ["a fractional number", 1.5],
    ["zero", 0],
    ["a negative number", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["past the safe integer range", Number.MAX_SAFE_INTEGER + 1],
  ])("rejects %s arriving as a number", (_case, userId) => {
    expect(parseRecoveryLink({ token: TOKEN, userId })).toBeNull();
  });

  /**
   * The edge of the accepted range, from both spellings.
   *
   * `Number.MAX_SAFE_INTEGER` is the last id two different accounts cannot share
   * a representation of, so it is in and the next one is out - and the string
   * form has to agree with the number form, because the coercion is where a
   * larger value collapses onto a smaller one.
   */
  it.each([
    ["as a number", Number.MAX_SAFE_INTEGER],
    ["as a string", String(Number.MAX_SAFE_INTEGER)],
  ])("accepts the largest safe userId %s", (_case, userId) => {
    expect(parseRecoveryLink({ token: TOKEN, userId })).toEqual({
      token: TOKEN,
      userId: Number.MAX_SAFE_INTEGER,
    });
  });

  /**
   * The shortest and longest tokens the bounds allow.
   *
   * Pinned because the bounds are inclusive and an off-by-one either way would
   * be invisible against a real 43-character token.
   */
  it.each([
    ["the shortest allowed", "a".repeat(16)],
    ["the longest allowed", "a".repeat(512)],
  ])("accepts %s token", (_case, token) => {
    expect(parseRecoveryLink({ token, userId: "1" })?.token).toBe(token);
  });

  it.each([
    ["one character short", "a".repeat(15)],
    ["one character long", "a".repeat(513)],
  ])("rejects a token %s", (_case, token) => {
    expect(parseRecoveryLink({ token, userId: "1" })).toBeNull();
  });

  it("keeps the token exactly as it arrived", () => {
    // The API compares it byte for byte against the stored row, so any
    // normalisation here would break every real link.
    const link = parseRecoveryLink({ token: TOKEN, userId: "1" });

    expect(link?.token).toBe(TOKEN);
  });
});
