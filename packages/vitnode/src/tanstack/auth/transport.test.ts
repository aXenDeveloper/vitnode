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
  finishPasskeySignIn: unreachable,
  linkSso: unreachable,
  readSession: unreachable,
  requestPasswordReset: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startPasskeySignIn: unreachable,
  startSso: unreachable,
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

  it("answers every call the contract names", () => {
    for (const call of Object.keys(stub)) {
      expect(authTransport()[call as keyof AuthTransport]).toBeTypeOf(
        "function",
      );
    }
  });
});

describe("an application that registers its own", () => {
  it("hands back exactly what was registered", () => {
    setAuthTransport(stub);

    expect(hasAuthTransport()).toBe(true);
    expect(authTransport()).toBe(stub);
  });

  it("overrides the built-in default rather than merging with it", () => {
    setAuthTransport(stub);

    expect(authTransport()).not.toBe(defaultAuthTransport);
  });

  /**
   * A hot reload re-evaluates the registering module, and a second call must not
   * be a build error - the newer function is the right one to keep.
   */
  it("replaces a previous registration rather than refusing", () => {
    const second = { ...stub };

    setAuthTransport(stub);
    setAuthTransport(second);

    expect(authTransport()).toBe(second);
  });

  it("falls back to the default once the override is dropped", () => {
    setAuthTransport(stub);
    resetAuthTransport();

    expect(authTransport()).toBe(defaultAuthTransport);
  });
});
