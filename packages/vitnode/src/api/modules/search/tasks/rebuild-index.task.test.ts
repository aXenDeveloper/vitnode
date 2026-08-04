// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type {
  SearchDocument,
  SearchIndexerConfig,
  SearchIndexerLoadResult,
} from "@/api/models/search";

import { rebuildSearchIndexTask } from "./rebuild-index.task";

const document = (
  itemType: string,
  itemId: number,
  extra: Partial<SearchDocument> = {},
): SearchDocument => ({
  content: "body",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  itemId,
  itemType,
  title: `Item ${itemId}`,
  ...extra,
});

/**
 * An indexer that replays a fixed list of pages, recording the offsets it was
 * asked for. Page contents are what each test is about; the offsets are what the
 * rebuild is supposed to derive from them.
 */
const scriptedIndexer = ({
  itemType,
  pages,
  pluginId,
}: {
  itemType: string;
  /**
   * Either result shape, so the same script drives a modern and a legacy
   * indexer. Past the end, each keeps returning its own "no more rows" signal.
   */
  pages: SearchIndexerLoadResult[];
  pluginId: string;
}) => {
  const offsets: number[] = [];
  const exhausted: SearchIndexerLoadResult = Array.isArray(pages[0])
    ? []
    : { documents: [], itemsRead: 0 };
  let call = 0;

  const config: SearchIndexerConfig = {
    itemType,
    load: async (_c, offset) => {
      offsets.push(offset);
      const page = pages[call] ?? exhausted;
      call++;

      return await Promise.resolve(page);
    },
    pluginId,
  };

  return { config, offsets };
};

const harness = (indexers: SearchIndexerConfig[]) => {
  const cleared: (string | undefined)[] = [];
  const indexed: SearchDocument[][] = [];

  const search = {
    bulkIndex: vi.fn(async (docs: SearchDocument[]) => {
      indexed.push(docs);
      await Promise.resolve();
    }),
    clear: vi.fn(async (itemType?: string) => {
      cleared.push(itemType);
      await Promise.resolve();
    }),
  };

  const c = {
    get: (key: string) => {
      if (key === "search") return search;
      if (key === "core") return { searchIndexers: indexers };

      return undefined;
    },
  } as unknown as Context<EnvVitNode>;

  return { c, cleared, indexed, search };
};

describe("rebuild-search-index", () => {
  it("keeps paging after a page that produced no documents", async () => {
    // The regression: every row on page 1 is rejected by the mapper. Treating an
    // empty document array as end-of-source would stop here and never index the
    // valid row on page 2.
    const { config, offsets } = scriptedIndexer({
      itemType: "test.searchable",
      pages: [
        { documents: [], itemsRead: 200 },
        { documents: [document("test.searchable", 201)], itemsRead: 1 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/example",
    });
    const { c, indexed } = harness([config]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(offsets).toEqual([0, 200, 201]);
    expect(indexed).toHaveLength(1);
    expect(indexed[0]?.[0]?.itemId).toBe(201);
  });

  it("stops when a page reads no source rows", async () => {
    const { config, offsets } = scriptedIndexer({
      itemType: "test.searchable",
      pages: [
        { documents: [document("test.searchable", 1)], itemsRead: 1 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/example",
    });
    const { c, indexed } = harness([config]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(offsets).toEqual([0, 1]);
    expect(indexed).toHaveLength(1);
  });

  it("never calls the engine for an empty document page", async () => {
    const { config } = scriptedIndexer({
      itemType: "test.searchable",
      pages: [
        { documents: [], itemsRead: 5 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/example",
    });
    const { c, indexed } = harness([config]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(indexed).toEqual([]);
  });

  it("advances by source items, not by documents", async () => {
    // A multi-language indexer emits several documents per item. Advancing by
    // document count would skip items on every page.
    const { config, offsets } = scriptedIndexer({
      itemType: "blog_post",
      pages: [
        {
          documents: [
            document("blog_post", 1, { languageCode: "en" }),
            document("blog_post", 1, { languageCode: "pl" }),
            document("blog_post", 2, { languageCode: "en" }),
            document("blog_post", 2, { languageCode: "pl" }),
          ],
          itemsRead: 2,
        },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/blog",
    });
    const { c, indexed } = harness([config]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(offsets).toEqual([0, 2]);
    expect(indexed[0]).toHaveLength(4);
  });

  describe("plugin ownership", () => {
    it("keeps an owner the document already declared", async () => {
      const { config } = scriptedIndexer({
        itemType: "test.searchable",
        pages: [
          {
            documents: [
              document("test.searchable", 1, { pluginId: "@vitnode/example" }),
            ],
            itemsRead: 1,
          },
          { documents: [], itemsRead: 0 },
        ],
        pluginId: "@vitnode/example",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(indexed[0]?.[0]?.pluginId).toBe("@vitnode/example");
    });

    it("stamps the registering plugin on a legacy document", async () => {
      // A hand-written indexer that predates `SearchDocument.pluginId`. Without
      // this the rebuild would store it as core, because the queue drains inside
      // the core cron request.
      const { config } = scriptedIndexer({
        itemType: "blog_post",
        pages: [
          { documents: [document("blog_post", 7)], itemsRead: 1 },
          { documents: [], itemsRead: 0 },
        ],
        pluginId: "@vitnode/blog",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(indexed[0]?.[0]?.pluginId).toBe("@vitnode/blog");
    });

    it("preserves ownership in a single-collection rebuild", async () => {
      const example = scriptedIndexer({
        itemType: "test.searchable",
        pages: [
          {
            documents: [
              document("test.searchable", 1, { pluginId: "@vitnode/example" }),
            ],
            itemsRead: 1,
          },
          { documents: [], itemsRead: 0 },
        ],
        pluginId: "@vitnode/example",
      });
      const blog = scriptedIndexer({
        itemType: "blog_post",
        pages: [{ documents: [document("blog_post", 1)], itemsRead: 1 }],
        pluginId: "@vitnode/blog",
      });
      const { c, cleared, indexed } = harness([example.config, blog.config]);

      await rebuildSearchIndexTask.handler(c, {
        itemType: "test.searchable",
      });

      // Scoped: the other plugin's collection is neither cleared nor reloaded.
      expect(cleared).toEqual(["test.searchable"]);
      expect(blog.offsets).toEqual([]);
      expect(indexed.flat().map(doc => doc.pluginId)).toEqual([
        "@vitnode/example",
      ]);
    });
  });

  it("clears the whole index for a full rebuild and each indexer runs", async () => {
    const first = scriptedIndexer({
      itemType: "a.one",
      pages: [
        { documents: [document("a.one", 1)], itemsRead: 1 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/a",
    });
    const second = scriptedIndexer({
      itemType: "b.two",
      pages: [
        { documents: [document("b.two", 1)], itemsRead: 1 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/b",
    });
    const { c, cleared, indexed } = harness([first.config, second.config]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(cleared).toEqual([undefined]);
    expect(indexed.flat().map(doc => doc.pluginId)).toEqual([
      "@vitnode/a",
      "@vitnode/b",
    ]);
  });

  describe("the deprecated array result", () => {
    it("indexes a legacy page and stops on the empty one", async () => {
      const { config, offsets } = scriptedIndexer({
        itemType: "legacy.item",
        pages: [[document("legacy.item", 1)], []],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      // No source count to advance by, so the cursor moves a whole page - which
      // is exactly what the old rebuild did.
      expect(offsets).toEqual([0, 200]);
      expect(indexed).toHaveLength(1);
      expect(indexed[0]?.[0]?.itemId).toBe(1);
    });

    it("stamps the registering plugin on a legacy document", async () => {
      const { config } = scriptedIndexer({
        itemType: "legacy.item",
        pages: [[document("legacy.item", 1)], []],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(indexed[0]?.[0]?.pluginId).toBe("@vitnode/legacy");
    });

    it("keeps an owner a legacy document declared itself", async () => {
      const { config } = scriptedIndexer({
        itemType: "legacy.item",
        pages: [
          [document("legacy.item", 1, { pluginId: "@vitnode/elsewhere" })],
          [],
        ],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(indexed[0]?.[0]?.pluginId).toBe("@vitnode/elsewhere");
    });

    it("treats a blank declared owner as absent", async () => {
      const { config } = scriptedIndexer({
        itemType: "legacy.item",
        pages: [[document("legacy.item", 1, { pluginId: "   " })], []],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(indexed[0]?.[0]?.pluginId).toBe("@vitnode/legacy");
    });

    it("does not mistake a multilingual document count for a source count", async () => {
      // Four documents, two source items, two languages. Advancing by the array
      // length would jump to offset 4 and skip most of a 200-row page.
      const { config, offsets } = scriptedIndexer({
        itemType: "legacy.multilingual",
        pages: [
          [
            document("legacy.multilingual", 1, { languageCode: "en" }),
            document("legacy.multilingual", 1, { languageCode: "pl" }),
            document("legacy.multilingual", 2, { languageCode: "en" }),
            document("legacy.multilingual", 2, { languageCode: "pl" }),
          ],
          [],
        ],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(offsets).toEqual([0, 200]);
      expect(offsets).not.toContain(4);
      expect(indexed[0]).toHaveLength(4);
    });

    it("indexes an empty first page as an exhausted source", async () => {
      // The ambiguity the modern contract exists to remove: an array cannot say
      // whether rows were read and all filtered out, so this ends the rebuild.
      const { config, offsets } = scriptedIndexer({
        itemType: "legacy.item",
        pages: [[], [document("legacy.item", 1)]],
        pluginId: "@vitnode/legacy",
      });
      const { c, indexed } = harness([config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(offsets).toEqual([0]);
      expect(indexed).toEqual([]);
    });

    it("runs alongside a modern indexer", async () => {
      const legacy = scriptedIndexer({
        itemType: "legacy.item",
        pages: [[document("legacy.item", 1)], []],
        pluginId: "@vitnode/legacy",
      });
      const modern = scriptedIndexer({
        itemType: "modern.item",
        pages: [
          { documents: [], itemsRead: 200 },
          { documents: [document("modern.item", 2)], itemsRead: 1 },
          { documents: [], itemsRead: 0 },
        ],
        pluginId: "@vitnode/modern",
      });
      const { c, indexed } = harness([legacy.config, modern.config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(legacy.offsets).toEqual([0, 200]);
      expect(modern.offsets).toEqual([0, 200, 201]);
      expect(indexed.flat().map(doc => [doc.itemId, doc.pluginId])).toEqual([
        [1, "@vitnode/legacy"],
        [2, "@vitnode/modern"],
      ]);
    });
  });

  describe("a collection with no indexer", () => {
    it("refuses a scoped rebuild before clearing anything", async () => {
      // The action offering this is called "reindex", so it must not be a delete:
      // clearing here would remove the documents and refill nothing.
      const other = scriptedIndexer({
        itemType: "example.article",
        pages: [{ documents: [], itemsRead: 0 }],
        pluginId: "@vitnode/example",
      });
      const { c, indexed, search } = harness([other.config]);

      await expect(
        rebuildSearchIndexTask.handler(c, { itemType: "removed.collection" }),
      ).rejects.toThrow(/no search indexer is registered/i);

      expect(search.clear).not.toHaveBeenCalled();
      expect(other.offsets).toEqual([]);
      expect(indexed).toEqual([]);
    });

    it("refuses even when no indexer is registered at all", async () => {
      const { c, search } = harness([]);

      await expect(
        rebuildSearchIndexTask.handler(c, { itemType: "removed.collection" }),
      ).rejects.toThrow(/removed.collection/);

      expect(search.clear).not.toHaveBeenCalled();
    });

    it("names the collection it refused", async () => {
      const { c } = harness([]);

      await expect(
        rebuildSearchIndexTask.handler(c, { itemType: "removed.collection" }),
      ).rejects.toThrow(/Cannot rebuild collection "removed.collection"/);
    });

    it("still lets a full rebuild clear the whole index", async () => {
      // Orphaned documents have no source, so a full rebuild removing them is the
      // documented behaviour - and it must not be blocked by the scoped guard.
      const registered = scriptedIndexer({
        itemType: "example.article",
        pages: [
          { documents: [document("example.article", 1)], itemsRead: 1 },
          { documents: [], itemsRead: 0 },
        ],
        pluginId: "@vitnode/example",
      });
      const { c, cleared, indexed } = harness([registered.config]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(cleared).toEqual([undefined]);
      expect(indexed.flat().map(doc => doc.itemId)).toEqual([1]);
    });

    it("still lets a full rebuild run with no indexers registered", async () => {
      const { c, cleared, indexed } = harness([]);

      await rebuildSearchIndexTask.handler(c, {});

      expect(cleared).toEqual([undefined]);
      expect(indexed).toEqual([]);
    });
  });

  it("clears and rebuilds only the scoped collection when it has an indexer", async () => {
    const target = scriptedIndexer({
      itemType: "example.article",
      pages: [
        { documents: [document("example.article", 1)], itemsRead: 1 },
        { documents: [], itemsRead: 0 },
      ],
      pluginId: "@vitnode/example",
    });
    const other = scriptedIndexer({
      itemType: "blog_post",
      pages: [{ documents: [document("blog_post", 9)], itemsRead: 1 }],
      pluginId: "@vitnode/blog",
    });
    const { c, cleared, indexed } = harness([target.config, other.config]);

    await rebuildSearchIndexTask.handler(c, { itemType: "example.article" });

    expect(cleared).toEqual(["example.article"]);
    expect(other.offsets).toEqual([]);
    expect(indexed.flat().map(doc => doc.itemId)).toEqual([1]);
  });

  it("does not loop forever on a broken indexer", async () => {
    // A page that reports rows but never advances past them would spin. The
    // cursor is the indexer's own `itemsRead`, so this asserts the loop is driven
    // by data rather than by a fixed page size.
    const load = vi.fn(
      async (_c: Context, offset: number) =>
        await Promise.resolve(
          offset === 0
            ? { documents: [], itemsRead: 3 }
            : { documents: [], itemsRead: 0 },
        ),
    );
    const { c } = harness([{ itemType: "x.y", load, pluginId: "@vitnode/x" }]);

    await rebuildSearchIndexTask.handler(c, {});

    expect(load).toHaveBeenCalledTimes(2);
  });
});
