import { buildQueueTask } from "@/api/lib/queue";

const PAGE_SIZE = 200;

export const rebuildSearchIndexTask = buildQueueTask({
  name: "rebuild-search-index",
  description:
    "Clear and rebuild the content search index. With no `itemType` payload it rebuilds every registered indexer; with one it rebuilds just that collection.",
  handler: async (c, payload) => {
    const search = c.get("search");
    const itemType =
      typeof payload.itemType === "string" ? payload.itemType : undefined;
    const indexers = c
      .get("core")
      .searchIndexers.filter(
        indexer => !itemType || indexer.itemType === itemType,
      );

    // Scope the clear to the target collection so a single-collection reindex
    // never wipes the rest of the index.
    await search.clear(itemType);

    for (const indexer of indexers) {
      // Offset advances by whole pages of items, not by document count: an
      // indexer may emit several documents per item (e.g. one per language), so
      // the two are not interchangeable. A page that yields no documents ends
      // the loop.
      for (let page = 0; ; page++) {
        const docs = await indexer.load(c, page * PAGE_SIZE, PAGE_SIZE);
        if (docs.length === 0) break;

        await search.bulkIndex(docs);
      }
    }
  },
});
