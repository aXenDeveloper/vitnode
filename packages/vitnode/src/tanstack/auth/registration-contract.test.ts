import { describe, expect, it } from "vitest";

import {
  shouldRefreshSessionAfterSignUp,
  signUpInputSchema,
  signUpResultFromStatus,
} from "./contract";

const success = { email: "test@test.com", emailVerified: true };

describe("sign-up results", () => {
  it("reads a 201 as an account, carrying the address and the flag", () => {
    expect(signUpResultFromStatus(201, { body: success })).toEqual({
      email: "test@test.com",
      emailVerified: true,
      ok: true,
    });
  });

  it("keeps an unverified account distinct from a verified one", () => {
    expect(
      signUpResultFromStatus(201, {
        body: { email: "test@test.com", emailVerified: false },
      }),
    ).toEqual({
      email: "test@test.com",
      emailVerified: false,
      ok: true,
    });
  });

  it.each([
    ["no body at all", undefined],
    ["a body with no flag", { email: "test@test.com" }],
    [
      "a flag that is not a boolean",
      { email: "a@b.com", emailVerified: "yes" },
    ],
    ["a body with no address", { emailVerified: true }],
    ["a string", "created"],
    ["null", null],
  ])("refuses to read %s as a session rather than guessing", (_case, body) => {
    // `emailVerified` decides whether the visitor now holds a session cookie.
    // A body that cannot be parsed must not read as `false` by accident, so an
    // unreadable 201 is a server error.
    expect(signUpResultFromStatus(201, { body })).toEqual({
      ok: false,
      reason: "server_error",
    });
  });

  it("reads a 400 as an invalid submission - which is also a refused captcha", () => {
    // `captchaMiddleware` answers 400 for both "token is required" and
    // "validation failed", and the API gives a caller no way to tell those from a
    // body its schema rejected.
    expect(signUpResultFromStatus(400)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it.each([
    ["Email already exists", "email_exists"],
    ["Name already exists", "name_exists"],
    ['{"error":"Email already exists"}', "email_exists"],
  ])("pins a 409 saying %s to a field", (conflict, reason) => {
    expect(signUpResultFromStatus(409, { conflict })).toEqual({
      ok: false,
      reason,
    });
  });

  it.each([undefined, "", "Something else", "Name code already exists"])(
    "reads a 409 nobody could classify (%s) as a plain conflict",
    conflict => {
      expect(signUpResultFromStatus(409, { conflict })).toEqual({
        ok: false,
        reason: "conflict",
      });
    },
  );

  it("keeps the rate limiter apart from a server failure", () => {
    // `notifyRateLimited` - the toast the browser fetcher raises - is a no-op on
    // a server, so a mutation behind a server function is the only place a 429
    // can be observed at all.
    expect(signUpResultFromStatus(429)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it.each([200, 202, 403, 404, 500, 503])(
    "collapses %i into one server_error",
    status => {
      expect(signUpResultFromStatus(status)).toEqual({
        ok: false,
        reason: "server_error",
      });
    },
  );

  it("never carries the API error body into the result", () => {
    const result = signUpResultFromStatus(409, {
      conflict: "Email already exists at /api/@vitnode/core/users/sign_up",
    });

    expect(JSON.stringify(result)).not.toContain("api");
  });
});

describe("the sign-up input schema", () => {
  const valid = {
    captchaToken: "token",
    email: "Test@Test.com",
    name: "tester",
    password: "Test123!",
  };

  it("lower-cases the address, exactly as the API does before it looks one up", () => {
    expect(signUpInputSchema.parse(valid).email).toBe("test@test.com");
  });

  it("treats a missing captcha token as an empty one", () => {
    // `useCaptcha` reports itself ready with no token when this deployment has no
    // captcha configured, and the API's middleware is a no-op in that case.
    const { captchaToken, ...rest } = valid;

    expect(captchaToken).toBe("token");
    expect(signUpInputSchema.parse(rest).captchaToken).toBe("");
  });

  it.each([
    ["a name with doubled spaces", { name: "te  ster" }],
    ["a name with a slash", { name: "te/ster" }],
    ["a name with a newline", { name: "tes\nter" }],
    ["a two-character name", { name: "ab" }],
    ["a name past 32 characters", { name: "a".repeat(33) }],
    ["a seven-character password", { password: "Test12!" }],
    ["an unbounded password", { password: "a".repeat(1025) }],
    ["an unbounded captcha token", { captchaToken: "a".repeat(8193) }],
    ["a value that is not an email address", { email: "test" }],
  ])("rejects %s", (_case, patch) => {
    expect(signUpInputSchema.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    );
  });

  it.each([
    ["letters beyond ASCII", "Zażółć gęślą"],
    ["digits", "tester2000"],
    ["the punctuation the API allows", "te.st_er-name@x"],
  ])("accepts %s in a name, as the API does", (_case, name) => {
    expect(signUpInputSchema.safeParse({ ...valid, name }).success).toBe(true);
  });

  it("does not accept a terms field it would forward", () => {
    // The tick is a local precondition; the API has no field for it, so it is
    // stripped rather than sent.
    const parsed = signUpInputSchema.parse({ ...valid, terms: true });

    expect(parsed).not.toHaveProperty("terms");
  });
});

describe("whether registration produced a session to go and read", () => {
  it("refreshes only for a verified account", () => {
    // Which is exactly when the API called `createSessionByUserId` on the same
    // request, so the 201 carried the cookie `saveApiCookies` has just written.
    expect(shouldRefreshSessionAfterSignUp({ ...success, ok: true })).toBe(
      true,
    );
  });

  it("does not pretend an unverified visitor is signed in", () => {
    expect(
      shouldRefreshSessionAfterSignUp({
        email: "test@test.com",
        emailVerified: false,
        ok: true,
      }),
    ).toBe(false);
  });

  it.each([
    "conflict",
    "email_exists",
    "invalid",
    "name_exists",
    "rate_limited",
    "server_error",
  ] as const)("does not refresh after a %s failure", reason => {
    expect(shouldRefreshSessionAfterSignUp({ ok: false, reason })).toBe(false);
  });
});
