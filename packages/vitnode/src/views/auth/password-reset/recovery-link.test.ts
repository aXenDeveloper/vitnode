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

  it("keeps the token exactly as it arrived", () => {
    // The API compares it byte for byte against the stored row, so any
    // normalisation here would break every real link.
    const link = parseRecoveryLink({ token: TOKEN, userId: "1" });

    expect(link?.token).toBe(TOKEN);
  });
});
