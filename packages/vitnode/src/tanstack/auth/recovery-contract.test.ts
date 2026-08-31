import { describe, expect, it } from "vitest";

import {
  changePasswordInputSchema,
  changePasswordResultFromStatus,
  passwordResetRequestInputSchema,
  passwordResetRequestResultFromStatus,
} from "./contract";

/**
 * The two password-recovery mutations' decisions, without the transport.
 *
 * The interesting property here is not a mapping but an *absence*: there is no
 * result the reset-request path can produce that says whether an address belongs
 * to an account, because the API answers the same 201 either way. Several of the
 * tests below exist to keep that true.
 */

/** What the API actually puts in the email: 32 random bytes as base64url. */
const TOKEN = "PSyRy0nQ0hRnfx3iCYldQ40mBLU9lqfDWtvNhrTsJI4";

describe("reset-request results", () => {
  it("reads a 201 as accepted", () => {
    expect(passwordResetRequestResultFromStatus(201)).toEqual({ ok: true });
  });

  it("answers the same way whether or not the address exists", () => {
    // Not a tautology: the API returns 201 for an unknown address, for a known
    // one, and for a known one it decided not to email because a link was already
    // requested in the last five minutes. One status, one result, nothing to
    // enumerate.
    expect(passwordResetRequestResultFromStatus(201)).toEqual({ ok: true });
  });

  it('has no reason that could mean "no such account"', () => {
    const reasons = new Set(
      [400, 429, 500, 503, 200].map(status => {
        const result = passwordResetRequestResultFromStatus(status);

        return result.ok ? "ok" : result.reason;
      }),
    );

    expect([...reasons].sort()).toEqual([
      "invalid",
      "rate_limited",
      "server_error",
    ]);
  });

  it("reads a 400 as an invalid submission - which is also a refused captcha", () => {
    expect(passwordResetRequestResultFromStatus(400)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("keeps the rate limiter apart from a server failure", () => {
    expect(passwordResetRequestResultFromStatus(429)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it.each([200, 204, 403, 404, 500, 503])(
    "collapses %i into one server_error",
    status => {
      expect(passwordResetRequestResultFromStatus(status)).toEqual({
        ok: false,
        reason: "server_error",
      });
    },
  );
});

describe("change-password results", () => {
  it("reads a 201 as changed", () => {
    expect(changePasswordResultFromStatus(201)).toEqual({ ok: true });
  });

  it("reads a 400 as a link that cannot be used", () => {
    // The API looks the row up by userId AND token AND an unexpired expiresAt, so
    // a wrong link, a spent link and a link older than thirty minutes are one
    // status - and "ask for a fresh one" is the answer to all three.
    expect(changePasswordResultFromStatus(400)).toEqual({
      ok: false,
      reason: "invalid_token",
    });
  });

  it("keeps the rate limiter apart from a server failure", () => {
    expect(changePasswordResultFromStatus(429)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it.each([200, 403, 404, 409, 500, 503])(
    "collapses %i into one server_error",
    status => {
      expect(changePasswordResultFromStatus(status)).toEqual({
        ok: false,
        reason: "server_error",
      });
    },
  );
});

describe("the reset-request input schema", () => {
  it("lower-cases the address, as the API does before it looks one up", () => {
    expect(
      passwordResetRequestInputSchema.parse({
        captchaToken: "token",
        email: "Test@Test.com",
      }).email,
    ).toBe("test@test.com");
  });

  it("treats a missing captcha token as an empty one", () => {
    expect(
      passwordResetRequestInputSchema.parse({ email: "test@test.com" })
        .captchaToken,
    ).toBe("");
  });

  it.each([
    ["a value that is not an email address", { email: "test" }],
    ["an unbounded captcha token", { captchaToken: "a".repeat(8193) }],
  ])("rejects %s", (_case, patch) => {
    expect(
      passwordResetRequestInputSchema.safeParse({
        captchaToken: "token",
        email: "test@test.com",
        ...patch,
      }).success,
    ).toBe(false);
  });
});

describe("the change-password input schema", () => {
  const valid = { password: "Test123!", token: TOKEN, userId: 123 };

  it("accepts what a parsed recovery link plus a password looks like", () => {
    expect(changePasswordInputSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ["a userId that is still a string", { userId: "123" }],
    ["a zero userId", { userId: 0 }],
    ["a negative userId", { userId: -1 }],
    ["a fractional userId", { userId: 1.5 }],
    ["a userId past the safe integer range", { userId: 2 ** 53 }],
    ["a token with a path separator", { token: `../${TOKEN}` }],
    ["a token with a space", { token: `${TOKEN} x` }],
    ["a token too short to be one", { token: "abc" }],
    ["an unbounded token", { token: "a".repeat(513) }],
    ["a seven-character password", { password: "Test12!" }],
    ["an unbounded password", { password: "a".repeat(1025) }],
  ])("rejects %s rather than forwarding it", (_case, patch) => {
    // This runs on the server-function boundary, where the input is whatever a
    // caller posted - not whatever the recovery URL contained.
    expect(
      changePasswordInputSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  });
});
