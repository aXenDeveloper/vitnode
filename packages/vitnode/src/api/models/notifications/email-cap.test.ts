import { describe, expect, it } from "vitest";

import { splitByHourlyEmailCap } from "./email-cap";

const now = new Date("2026-10-04T12:00:00Z");

describe("splitByHourlyEmailCap", () => {
  it("sends everything when there is no cap", () => {
    const result = splitByHourlyEmailCap({
      cap: 0,
      deliveries: [
        { id: 1, mode: "immediate", userId: 7 },
        { id: 2, mode: "immediate", userId: 7 },
      ],
      now,
      sentInLastHour: new Map([[7, [now, now, now]]]),
    });

    expect(result.allowed).toEqual([1, 2]);
    expect(result.deferred.size).toBe(0);
  });

  it("holds immediate emails over the cap until the oldest one leaves the hour", () => {
    const result = splitByHourlyEmailCap({
      cap: 2,
      deliveries: [
        { id: 1, mode: "immediate", userId: 7 },
        { id: 2, mode: "immediate", userId: 7 },
        { id: 3, mode: "immediate", userId: 8 },
      ],
      now,
      sentInLastHour: new Map([[7, [new Date("2026-10-04T11:20:00Z")]]]),
    });

    expect(result.allowed).toEqual([1, 3]);
    expect(result.deferred.get(2)).toEqual(new Date("2026-10-04T12:20:00Z"));
  });

  it("never holds back digests", () => {
    const result = splitByHourlyEmailCap({
      cap: 1,
      deliveries: [{ id: 1, mode: "daily", userId: 7 }],
      now,
      sentInLastHour: new Map([[7, [now]]]),
    });

    expect(result.allowed).toEqual([1]);
  });
});
