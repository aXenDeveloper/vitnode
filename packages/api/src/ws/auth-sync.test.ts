import { describe, expect, it } from "vitest";

import { shouldReconnectForUser } from "./auth-sync";

describe("shouldReconnectForUser", () => {
  it("reconnects when a guest signs in", () => {
    expect(shouldReconnectForUser(null, 7)).toBe(true);
  });

  it("reconnects when a signed-in visitor signs out", () => {
    expect(shouldReconnectForUser(7, null)).toBe(true);
  });

  it("reconnects when one visitor is replaced by another", () => {
    expect(shouldReconnectForUser(7, 9)).toBe(true);
  });

  it("does nothing when the session answers the same visitor again", () => {
    // What a re-render, a refetch or a route change produces. The socket is
    // already authenticated as this user.
    expect(shouldReconnectForUser(7, 7)).toBe(false);
  });

  it("does nothing when a guest is still a guest", () => {
    expect(shouldReconnectForUser(null, null)).toBe(false);
  });

  it("does nothing on the first identity a client learns", () => {
    // The client-side session read: the socket opened with the visitor's
    // cookies, so the server already has the right user. Reconnecting here
    // would re-open every tab's connection on every page load.
    expect(shouldReconnectForUser(undefined, 7)).toBe(false);
    expect(shouldReconnectForUser(undefined, null)).toBe(false);
  });

  it("does nothing when the session becomes unknown", () => {
    // Nothing has been learned, so nothing is decided - and the caller keeps
    // the last identity it did know rather than treating this as a sign-out.
    expect(shouldReconnectForUser(7, undefined)).toBe(false);
    expect(shouldReconnectForUser(null, undefined)).toBe(false);
    expect(shouldReconnectForUser(undefined, undefined)).toBe(false);
  });
});
