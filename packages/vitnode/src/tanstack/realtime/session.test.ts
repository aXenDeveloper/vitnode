import { describe, expect, it } from "vitest";

import { socketUserIdFromSession } from "./session";

/**
 * The realtime contract, on the client's side of it:
 *
 *     session (the canonical query)  ->  socketUserIdFromSession  ->  WebSocketAuthSync
 *
 * Only this derivation is tested, and it is the only part worth testing here.
 * What follows it is `shouldReconnectForUser` in `@/ws/auth-sync`, which has its
 * own tests, and below that a WebSocket - and a fake socket proves nothing about
 * a real handshake, which is where the identity is actually decided.
 *
 * What can go wrong on this side is the distinction between "signed out" and
 * "not known yet". Both are falsy, both would read as a guest, and collapsing
 * them re-opens the shared connection on every page load for every signed-in
 * visitor - with no error anywhere to say so.
 */
describe("socketUserIdFromSession", () => {
  it("reports the signed-in visitor", () => {
    expect(socketUserIdFromSession({ user: { id: 42 } })).toBe(42);
  });

  it("reports a guest as null, not as unknown", () => {
    // The API answered. `null` is a fact, and it is what makes a sign-out a
    // transition the socket follows.
    expect(socketUserIdFromSession({ user: null })).toBeNull();
  });

  it("reports an unread session as unknown, not as a guest", () => {
    // No cache entry, or a failed read that `retry: false` left without data.
    // Answering `null` here would be inventing a guest, and on a client-side
    // read it is the first value of every page load.
    expect(socketUserIdFromSession(undefined)).toBeUndefined();
  });

  it("keeps the three answers distinguishable", () => {
    // The property the two tests above exist for, stated once: none of the
    // three inputs may collapse into another.
    const answers = [
      socketUserIdFromSession(undefined),
      socketUserIdFromSession({ user: null }),
      socketUserIdFromSession({ user: { id: 1 } }),
    ];

    expect(new Set(answers).size).toBe(3);
  });
});
