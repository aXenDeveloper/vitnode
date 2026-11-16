import { describe, expect, it } from "vitest";

import { resolvePageCacheConfig } from "./config";
import {
  formatPageCachePolicy,
  PageCachePolicyError,
  readPageCacheSetting,
} from "./policy";

describe("readPageCacheSetting", () => {
  it.each([
    [undefined, undefined],
    [false, false],
    [{ maxAge: 300 }, { maxAge: 300 }],
    [
      { maxAge: 300, staleWhileRevalidate: 60 },
      { maxAge: 300, staleWhileRevalidate: 60 },
    ],
    [{ maxAge: 300, staleWhileRevalidate: 0 }, { maxAge: 300 }],
  ])("reads %j as %j", (value, expected) => {
    expect(readPageCacheSetting(value, "route")).toEqual(expected);
  });

  it.each([
    ["true", true],
    ["a number", 300],
    ["an array", [300]],
    ["a policy without maxAge", { staleWhileRevalidate: 60 }],
    ["a zero maxAge", { maxAge: 0 }],
    ["a fractional maxAge", { maxAge: 1.5 }],
    ["a maxAge over a year", { maxAge: 31_536_001 }],
    ["a maxAge in a string", { maxAge: "300" }],
    ["a negative SWR", { maxAge: 300, staleWhileRevalidate: -1 }],
    ["an infinite SWR", { maxAge: 300, staleWhileRevalidate: Infinity }],
    ["an unknown option", { maxAge: 300, tags: ["post"] }],
  ])("refuses %s", (_, value) => {
    expect(() => readPageCacheSetting(value, "route")).toThrow(
      PageCachePolicyError,
    );
  });
});

describe("resolvePageCacheConfig", () => {
  it("is on, in memory, with no overrides by default", () => {
    expect(resolvePageCacheConfig(undefined)).toEqual({
      enabled: true,
      routes: {},
      storage: "memory",
    });
  });

  it("reads every override", () => {
    expect(
      resolvePageCacheConfig({
        routes: { "/blog/:slug": { maxAge: 60 }, "/docs": false },
        storage: "redis",
      }),
    ).toEqual({
      enabled: true,
      routes: { "/blog/:slug": { maxAge: 60 }, "/docs": false },
      storage: "redis",
    });
  });

  it.each([
    ["not an object", "memory"],
    ["enabled is not a boolean", { enabled: "yes" }],
    ["storage is unknown", { storage: "disk" }],
    ["routes is not an object", { routes: ["/blog"] }],
    ["an override is invalid", { routes: { "/blog": { maxAge: -1 } } }],
  ])("refuses a block where %s", (_, value) => {
    expect(() => resolvePageCacheConfig(value)).toThrow(PageCachePolicyError);
  });
});

describe("formatPageCachePolicy", () => {
  it.each([
    [{ maxAge: 300, staleWhileRevalidate: 60 }, "TTL 5m · SWR 1m"],
    [{ maxAge: 90 }, "TTL 1m 30s"],
    [{ maxAge: 7_200, staleWhileRevalidate: 86_400 }, "TTL 2h · SWR 1d"],
  ])("formats %j as %s", (policy, expected) => {
    expect(formatPageCachePolicy(policy)).toBe(expected);
  });
});
