import { buildQueueTask } from "@/api/lib/queue";

const PAGE_SIZE = 200;

export const rebuildSearchIndexTask = buildQueueTask({
  name: "rebuild-search-index",
  description:
    "Clear and rebuild the content search index from every registered indexer.",
  handler: async c => {
    const search = c.get("search");
    const indexers = c.get("core").searchIndexers;

    await search.clear();

    for (const indexer of indexers) {
      let offset = 0;

      for (;;) {
        const docs = await indexer.load(c, offset, PAGE_SIZE);
        if (docs.length === 0) break;

        await search.bulkIndex(docs);
        offset += docs.length;

        if (docs.length < PAGE_SIZE) break;
      }
    }
  },
});
