import { describe, expect, it } from "vitest";

import { deepMerge } from "./deep-merge";

describe("deepMerge", () => {
  it("merges nested objects key by key", () => {
    const result = deepMerge(
      { core: { global: { cancel: "Cancel", save: "Save" } } },
      { core: { global: { save: "Zapisz" } } },
    );

    expect(result).toEqual({
      core: { global: { cancel: "Cancel", save: "Zapisz" } },
    });
  });

  it("keeps namespaces the source does not mention", () => {
    const result = deepMerge(
      { "@vitnode/blog": { title: "Blog" }, core: { title: "Core" } },
      { "@vitnode/blog": { title: "Wpisy" } },
    );

    expect(result).toEqual({
      "@vitnode/blog": { title: "Wpisy" },
      core: { title: "Core" },
    });
  });

  it("replaces arrays and primitives instead of merging them", () => {
    expect(deepMerge({ items: ["a", "b"] }, { items: ["c"] })).toEqual({
      items: ["c"],
    });
    expect(deepMerge({ value: { nested: true } }, { value: "flat" })).toEqual({
      value: "flat",
    });
  });

  it("does not mutate either input", () => {
    const target = { core: { save: "Save" } };
    const source = { core: { save: "Zapisz" } };

    deepMerge(target, source);

    expect(target).toEqual({ core: { save: "Save" } });
    expect(source).toEqual({ core: { save: "Zapisz" } });
  });

  it("ignores __proto__ so a locale file cannot touch the prototype", () => {
    const parsed = JSON.parse('{"__proto__":{"polluted":true}}') as Record<
      string,
      unknown
    >;
    const result = deepMerge({}, parsed);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect({}).not.toHaveProperty("polluted");
  });
});
