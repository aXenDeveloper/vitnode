/* eslint-disable @typescript-eslint/no-deprecated -- Asserting that the
   deprecated result shape still compiles is the point of this file. */
import { assertType, describe, expectTypeOf, it } from "vitest";

import type { ContentSearchIndexer } from "@/content/server";

import type {
  LegacySearchIndexerPage,
  SearchDocument,
  SearchIndexer,
  SearchIndexerLoadResult,
  SearchIndexerPage,
} from "./search";

const document: SearchDocument = {
  content: "body",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId: 1,
  itemType: "custom_item",
  title: "Hello",
};

describe("SearchIndexer.load", () => {
  it("accepts the preferred page result", () => {
    assertType<SearchIndexer>({
      itemType: "custom_item",
      load: async (_c, _offset, limit) =>
        await Promise.resolve({ documents: [document], itemsRead: limit }),
    });
  });

  it("still accepts the deprecated array result", () => {
    // Exactly what a plugin written before Stage 3 looks like. It has to keep
    // compiling: `SearchIndexer` is a documented public import.
    const legacyIndexer: SearchIndexer = {
      itemType: "legacy.item",
      load: async () => await Promise.resolve([]),
    };

    assertType<SearchIndexer>(legacyIndexer);
    assertType<SearchIndexer>({
      itemType: "legacy.item",
      load: async () => await Promise.resolve([document]),
    });
  });

  it("accepts an indexer that returns either shape", () => {
    assertType<SearchIndexer>({
      count: async () => await Promise.resolve(1),
      itemType: "either",
      load: async (_c, offset) =>
        await Promise.resolve(
          offset === 0 ? { documents: [document], itemsRead: 1 } : [],
        ),
    });
  });

  it("rejects a result that is neither shape", () => {
    assertType<SearchIndexer>({
      itemType: "wrong",
      // @ts-expect-error - a bare document is not a page and not an array.
      load: async () => await Promise.resolve(document),
    });
  });

  it("rejects a page missing its source count", () => {
    assertType<SearchIndexer>({
      itemType: "wrong",
      // @ts-expect-error - `itemsRead` is what the rebuild pages by.
      load: async () => await Promise.resolve({ documents: [document] }),
    });
  });
});

describe("SearchIndexerLoadResult", () => {
  it("is the union of the page and the deprecated array", () => {
    expectTypeOf<SearchIndexerPage>().toExtend<SearchIndexerLoadResult>();
    expectTypeOf<LegacySearchIndexerPage>().toExtend<SearchIndexerLoadResult>();
    expectTypeOf<LegacySearchIndexerPage>().toEqualTypeOf<SearchDocument[]>();
  });
});

describe("ContentSearchIndexer", () => {
  it("is a SearchIndexer pinned to the page result", () => {
    expectTypeOf<ContentSearchIndexer>().toExtend<SearchIndexer>();
    expectTypeOf<
      Awaited<ReturnType<ContentSearchIndexer["load"]>>
    >().toEqualTypeOf<SearchIndexerPage>();
  });
});
