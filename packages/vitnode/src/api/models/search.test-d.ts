import { assertType, describe, it } from "vitest";

import type { SearchDocument, SearchIndexer } from "./search";

const document: SearchDocument = {
  content: "body",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId: 1,
  itemType: "custom_item",
  title: "Hello",
};

describe("SearchIndexer.load", () => {
  it("accepts the page result and the deprecated array result", () => {
    assertType<SearchIndexer>({
      itemType: "custom_item",
      load: async (_c, _offset, limit) =>
        await Promise.resolve({ documents: [document], itemsRead: limit }),
    });
    assertType<SearchIndexer>({
      itemType: "legacy.item",
      load: async () => await Promise.resolve([document]),
    });
  });

  it("rejects a result that is neither shape", () => {
    assertType<SearchIndexer>({
      itemType: "wrong",
      // @ts-expect-error - a bare document is not a page and not an array.
      load: async () => await Promise.resolve(document),
    });
    assertType<SearchIndexer>({
      itemType: "wrong",
      // @ts-expect-error - `itemsRead` is what the rebuild pages by.
      load: async () => await Promise.resolve({ documents: [document] }),
    });
  });
});
