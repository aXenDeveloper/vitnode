// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  testLocalizedSearchPageContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import { createContentModel } from "./model";
import { syncContentLocalizedSearch } from "./search-sync";

const model = createContentModel(testLocalizedSearchPageContentType);
const plain = createContentModel(testSearchablePostContentType);

const search = {
  delete: vi.fn(async () => await Promise.resolve()),
  index: vi.fn(async () => await Promise.resolve()),
};

const logged: string[] = [];

const context = () =>
  ({
    get: (key: string) => {
      if (key === "search") return search;
      if (key === "log") {
        return {
          error: async (message: string) => {
            logged.push(message);

            return await Promise.resolve();
          },
        };
      }

      throw new Error(
        `A delete must not read "${key}" - the rows it would read are gone.`,
      );
    },
  }) as unknown as Context;

const row = {
  featured: false,
  id: 7,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  status: "published",
};

beforeEach(() => {
  search.delete.mockClear();
  search.index.mockClear();
  logged.length = 0;
});

describe("deleting a translation", () => {
  it("removes that language's document and no other", async () => {
    const outcomes = await syncContentLocalizedSearch(context(), model, {
      locale: "pl",
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    expect(search.delete).toHaveBeenCalledTimes(1);
    expect(search.delete).toHaveBeenCalledWith(
      "test.localized-search-page",
      7,
      "pl",
    );
    expect(outcomes).toEqual([
      {
        action: "delete",
        documentId: "test.localized-search-page:7:pl",
      },
    ]);
  });

  it("names the language in the diagnostic id", async () => {
    // A log line saying `...:7` after a Polish delete reads as "the record went",
    // which is the thing that did not happen.
    const [outcome] = await syncContentLocalizedSearch(context(), model, {
      locale: "pl",
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    expect(outcome.documentId).toBe("test.localized-search-page:7:pl");
  });

  it("enumerates nothing, because the translation rows are already gone", async () => {
    // The fake context throws on any key but `search` and `log`: a delete that
    // tried to read the translation table would be reading rows the mutation has
    // just removed.
    await expect(
      syncContentLocalizedSearch(context(), model, {
        locale: "pl",
        operation: "delete",
        pluginId: "@vitnode/example",
        row,
      }),
    ).resolves.toHaveLength(1);
  });

  it("treats a blank locale as no locale rather than as a language", async () => {
    await syncContentLocalizedSearch(context(), model, {
      locale: "   ",
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    expect(search.delete).toHaveBeenCalledWith(
      "test.localized-search-page",
      7,
      undefined,
    );
  });
});

describe("deleting the record", () => {
  it("removes every language in one call", async () => {
    const outcomes = await syncContentLocalizedSearch(context(), model, {
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    // No language argument, so every `(itemType, itemId, *)` row goes - which is
    // what deleting the record means and is why it cannot enumerate first.
    expect(search.delete).toHaveBeenCalledWith(
      "test.localized-search-page",
      7,
      undefined,
    );
    expect(outcomes).toEqual([
      { action: "delete", documentId: "test.localized-search-page:7" },
    ]);
  });

  it("keeps the mutation successful when the engine throws", async () => {
    search.delete.mockRejectedValueOnce(new Error("engine unavailable"));

    const [outcome] = await syncContentLocalizedSearch(context(), model, {
      locale: "pl",
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    expect(outcome.error?.message).toBe("engine unavailable");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("test.localized-search-page:7:pl");
  });
});

describe("a content type that is not localized", () => {
  it("is never routed through the localized sync", async () => {
    const outcomes = await syncContentLocalizedSearch(context(), plain, {
      locale: "pl",
      operation: "delete",
      pluginId: "@vitnode/example",
      row,
    });

    expect(outcomes).toEqual([]);
    expect(search.delete).not.toHaveBeenCalled();
  });
});
