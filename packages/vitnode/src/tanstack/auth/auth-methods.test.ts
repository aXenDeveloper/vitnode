import { describe, expect, it } from "vitest";

import type { MiddlewareConfig } from "./middleware-config";

import { authMethodsOf, hasSignInMethod } from "./middleware-config";

const config = (
  overrides: Partial<MiddlewareConfig> = {},
): MiddlewareConfig => ({
  ai: { models: [] },
  bottomBar: [],
  isEmail: true,
  navigation: [],
  passkeys: true,
  password: true,
  sso: [],
  ...overrides,
});

const GOOGLE = { id: "google", name: "Google" };

describe("authMethodsOf", () => {
  it("offers everything on a default install", () => {
    const methods = authMethodsOf(config());

    expect(methods).toMatchObject({
      passkey: true,
      password: true,
      resetPassword: true,
      signUp: true,
    });
    expect(hasSignInMethod(methods)).toBe(true);
  });

  it("drops the password form, reset link and sign-up when passwords are off", () => {
    const methods = authMethodsOf(config({ password: false }));

    expect(methods).toMatchObject({
      password: false,
      resetPassword: false,
      signUp: false,
    });
    expect(hasSignInMethod(methods)).toBe(true);
  });

  it("keeps sign-up when a social login can still create accounts", () => {
    expect(
      authMethodsOf(config({ password: false, sso: [GOOGLE] })).signUp,
    ).toBe(true);
  });

  it("hides the reset link without an email adapter", () => {
    expect(authMethodsOf(config({ isEmail: false })).resetPassword).toBe(false);
  });

  it("reports when no way to sign in is left", () => {
    expect(
      hasSignInMethod(
        authMethodsOf(config({ passkeys: false, password: false })),
      ),
    ).toBe(false);
  });
});
