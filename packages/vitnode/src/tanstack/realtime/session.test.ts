import { describe, expect, it } from "vitest";

import { socketUserIdFromSession } from "./session";

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
