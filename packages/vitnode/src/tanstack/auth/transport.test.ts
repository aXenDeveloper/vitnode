import { describe, expect, it } from "vitest";

import {
  AUTH_TRANSPORT_MISSING,
  authTransport,
  hasAuthTransport,
  setAuthTransport,
} from "./transport";

/** A transport whose calls would fail loudly if anything below reached one. */
const unreachable = () => {
  throw new Error("no call is made in this suite");
};

const stub = {
  changePasswordFromReset: unreachable,
  completeSso: unreachable,
  readSession: unreachable,
  requestPasswordReset: unreachable,
  signIn: unreachable,
  signOut: unreachable,
  signUp: unreachable,
  startSso: unreachable,
};

describe("before an application registers its server functions", () => {
  it("has no transport", () => {
    expect(hasAuthTransport()).toBe(false);
  });

  it("says what is missing rather than answering undefined", () => {
    expect(() => authTransport()).toThrow(AUTH_TRANSPORT_MISSING);
  });

  it("names the call that fixes it", () => {
    // The message is the documentation a host actually reads, so it has to carry
    // the function's name rather than a description of the problem.
    expect(AUTH_TRANSPORT_MISSING).toContain("setAuthTransport()");
  });
});

describe("once it has", () => {
  it("hands back exactly what was registered", () => {
    setAuthTransport(stub);

    expect(hasAuthTransport()).toBe(true);
    expect(authTransport()).toBe(stub);
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
});
