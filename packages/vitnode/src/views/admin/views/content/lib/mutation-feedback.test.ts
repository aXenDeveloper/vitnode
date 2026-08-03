import { describe, expect, it } from "vitest";

import { contentErrorKey } from "./mutation-feedback";

describe("contentErrorKey", () => {
  it.each([
    [400, "validation"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
  ])("maps %i to the %s message", (status, key) => {
    expect(contentErrorKey(status)).toBe(key);
  });

  it("tells a restricted delete apart from a server fault", () => {
    // The whole point: a 409 is explainable, a 500 is not, and they must never
    // read the same.
    expect(contentErrorKey(409)).not.toBe(contentErrorKey(500));
  });

  it("falls through to the generic message for anything unrecognised", () => {
    expect(contentErrorKey(500)).toBeNull();
    expect(contentErrorKey(502)).toBeNull();
    expect(contentErrorKey(undefined)).toBeNull();
  });
});
