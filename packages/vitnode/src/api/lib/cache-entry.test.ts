import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  CacheEntryDefinitionError,
  cacheEntryKey,
  defineCacheEntry,
} from "./cache-entry";

const valid = {
  pluginId: "@vitnode/forum",
  name: "stats",
  version: 1,
  schema: z.object({}),
  ttlSeconds: 60,
};

describe("defineCacheEntry", () => {
  it.each([
    ["a name with a space", { name: "forum stats" }],
    ["a name starting with a dot", { name: ".stats" }],
    ["a version of 0", { version: 0 }],
    ["a fractional version", { version: 1.5 }],
    ["a TTL of 0", { ttlSeconds: 0 }],
    ["a fractional TTL", { ttlSeconds: 0.5 }],
  ])("refuses %s", (_, override) => {
    expect(() => defineCacheEntry({ ...valid, ...override })).toThrow(
      CacheEntryDefinitionError,
    );
  });
});

describe("cacheEntryKey", () => {
  it.each([
    ["a string over 256 characters", ["x".repeat(257)]],
    ["NaN", [Number.NaN]],
    ["Infinity", [Number.POSITIVE_INFINITY]],
    ["an object", [{ id: 1 }]],
    ["null", [null]],
    ["more than 8 parts", [1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ])("refuses %s", (_, parts) => {
    expect(() => cacheEntryKey(valid, parts)).toThrow(
      CacheEntryDefinitionError,
    );
  });

  it("gives every type, version and plugin its own key", () => {
    const keys = [
      cacheEntryKey(valid, [1]),
      cacheEntryKey(valid, ["1"]),
      cacheEntryKey(valid, [true]),
      cacheEntryKey(valid, ["true"]),
      cacheEntryKey({ ...valid, version: 2 }, [1]),
      cacheEntryKey({ ...valid, pluginId: "@vitnode/blog" }, [1]),
      cacheEntryKey(valid, [1, 2]),
      cacheEntryKey(valid, ["1,2"]),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });
});
