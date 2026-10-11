import { afterEach, describe, expect, it } from "vitest";

import type { AuthTransport } from "./transport";

import { defaultAuthTransport } from "./default-transport";
import {
  authTransport,
  hasAuthTransport,
  resetAuthTransport,
  setAuthTransport,
} from "./transport";

/** A transport whose calls would fail loudly if anything below reached one. */
const unreachable = () => {
  throw new Error("no call is made in this suite");
};

const stub: AuthTransport = {
  changePasswordFromReset: unreachable,
  completeSso: unreachable,
  finishAdminPasskeySignIn: unreachable,
  finishPasskeySignIn: unreachable,
  linkSso: unreachable,
  readSession: unreachable,
  requestPasswordReset: unreachable,
  resendEmailVerification: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startAdminPasskeySignIn: unreachable,
  startPasskeySignIn: unreachable,
  startSso: unreachable,
  verifyEmail: unreachable,
};

afterEach(() => {
  resetAuthTransport();
});

describe("an application that registers nothing", () => {
  it("still has a working transport", () => {
    expect(authTransport()).toBe(defaultAuthTransport);
  });

  it("reports that nothing of its own is registered", () => {
    expect(hasAuthTransport()).toBe(false);
  });
});

describe("an application that registers its own", () => {
  it("hands back exactly what was registered", () => {
    setAuthTransport(stub);

    expect(hasAuthTransport()).toBe(true);
    expect(authTransport()).toBe(stub);
  });

  it("falls back to the default once the override is dropped", () => {
    setAuthTransport(stub);
    resetAuthTransport();

    expect(authTransport()).toBe(defaultAuthTransport);
  });
});
