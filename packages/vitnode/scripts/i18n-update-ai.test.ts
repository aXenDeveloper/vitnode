import { describe, expect, it } from "vitest";

import {
  applyTranslations,
  chunk,
  collectUntranslated,
  isTranslatable,
  mapPool,
  uniqueSources,
} from "./i18n-update-ai";

const delay = async (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

describe("isTranslatable", () => {
  it("accepts strings that contain a letter", () => {
    expect(isTranslatable("Save")).toBe(true);
    expect(isTranslatable("Hello {name}")).toBe(true);
    expect(isTranslatable("Zapisz")).toBe(true);
  });

  it("rejects empty, whitespace, and letter-free strings", () => {
    expect(isTranslatable("")).toBe(false);
    expect(isTranslatable("   ")).toBe(false);
    expect(isTranslatable("{count}")).toBe(false);
    expect(isTranslatable("—")).toBe(false);
    expect(isTranslatable("123")).toBe(false);
  });
});

describe("collectUntranslated", () => {
  it("collects leaves the target still shows in English", () => {
    const english = { core: { greeting: "Hello", save: "Save" } };
    const target = { core: { greeting: "Hello", save: "Zapisz" } };

    expect(collectUntranslated(english, target)).toEqual([
      { path: ["core", "greeting"], source: "Hello" },
    ]);
  });

  it("never collects a leaf that differs (an existing translation)", () => {
    const english = { a: "One", b: "Two" };
    const target = { a: "Jeden", b: "Dwa" };

    expect(collectUntranslated(english, target)).toEqual([]);
  });

  it("collects a missing target leaf via its undefined value", () => {
    // `undefined !== "Save"`, so a key the target lacks is not collected here;
    // reconcileTree runs first in the command to seed it with English.
    const english = { a: "Save" };
    const seeded = { a: "Save" };

    expect(collectUntranslated(english, seeded)).toEqual([
      { path: ["a"], source: "Save" },
    ]);
  });

  it("skips letter-free and empty sources", () => {
    const english = { dash: "—", label: "Name", empty: "" };
    const target = { dash: "—", label: "Name", empty: "" };

    expect(collectUntranslated(english, target)).toEqual([
      { path: ["label"], source: "Name" },
    ]);
  });

  it("recurses through nested objects", () => {
    const english = {
      "@vitnode/blog": { posts: { create: "Create", title: "Title" } },
    };
    const target = {
      "@vitnode/blog": { posts: { create: "Utwórz", title: "Title" } },
    };

    expect(collectUntranslated(english, target)).toEqual([
      { path: ["@vitnode/blog", "posts", "title"], source: "Title" },
    ]);
  });
});

describe("applyTranslations", () => {
  it("writes each translation at its leaf without mutating the input", () => {
    const tree = { core: { greeting: "Hello", save: "Zapisz" } };
    const result = applyTranslations(tree, [
      { path: ["core", "greeting"], value: "Cześć" },
    ]);

    expect(result).toEqual({ core: { greeting: "Cześć", save: "Zapisz" } });
    // Original untouched.
    expect(tree).toEqual({ core: { greeting: "Hello", save: "Zapisz" } });
  });

  it("skips a path whose parent is not an object", () => {
    const tree = { a: "leaf" };
    const result = applyTranslations(tree, [
      { path: ["a", "b"], value: "nope" },
    ]);

    expect(result).toEqual({ a: "leaf" });
  });

  it("ignores an empty path", () => {
    const tree = { a: "x" };

    expect(applyTranslations(tree, [{ path: [], value: "y" }])).toEqual({
      a: "x",
    });
  });
});

describe("chunk", () => {
  it("splits into consecutive slices of at most `size`", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns an empty array for no items", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("keeps a single slice when everything fits", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("uniqueSources", () => {
  it("dedups sources, keeping first-seen order", () => {
    const leaves = [
      { path: ["a"], source: "Save" },
      { path: ["b"], source: "Cancel" },
      { path: ["c"], source: "Save" },
      { path: ["d", "e"], source: "Cancel" },
      { path: ["f"], source: "Name" },
    ];

    expect(uniqueSources(leaves)).toEqual(["Save", "Cancel", "Name"]);
  });

  it("returns an empty array for no leaves", () => {
    expect(uniqueSources([])).toEqual([]);
  });
});

describe("mapPool", () => {
  it("returns results in input order regardless of finish order", async () => {
    // The first item is the slowest, yet its result stays at index 0.
    const results = await mapPool([30, 5, 15], 3, async ms => {
      await delay(ms);

      return ms * 2;
    });

    expect(results).toEqual([60, 10, 30]);
  });

  it("never runs more than `concurrency` workers at once", async () => {
    let active = 0;
    let peak = 0;
    await mapPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(5);
      active -= 1;

      return null;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty item list", async () => {
    let calls = 0;
    const results = await mapPool([], 4, async () => {
      calls += 1;
      await Promise.resolve();

      return null;
    });

    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });
});
