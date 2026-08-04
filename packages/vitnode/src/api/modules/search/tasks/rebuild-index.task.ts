import { buildQueueTask } from "@/api/lib/queue";
import {
  normalizeSearchIndexerPage,
  searchDocumentOwner,
} from "@/api/models/search";

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

    // Clearing a collection nothing can rebuild is a delete, not a rebuild. The
    // route rejects this too, but the check has to be here as well: a queue task
    // can be dispatched directly, and a job queued while an indexer was still
    // registered can drain after the plugin is gone.
    if (itemType && indexers.length === 0) {
      throw new Error(
        `[Search] Cannot rebuild collection "${itemType}": no search indexer is registered. Its documents were left alone - remove them explicitly if that is what you meant.`,
      );
    }

    // Scope the clear to the target collection so a single-collection reindex
    // never wipes the rest of the index.
    await search.clear(itemType);

    for (const indexer of indexers) {
      // The cursor advances by source rows read, never by documents produced: an
      // indexer may emit several documents per item, or none for a page whose
      // rows it cannot project. Ending on an empty document array would stop the
      // rebuild at the first such page and never reach the rows after it.
      //
      // A legacy indexer returning a bare array is normalized to the same shape,
      // where a non-empty page reports the requested limit - the only cursor the
      // old contract ever had.
      for (let offset = 0; ;) {
        const page = normalizeSearchIndexerPage(
          await indexer.load(c, offset, PAGE_SIZE),
          PAGE_SIZE,
        );
        if (page.itemsRead === 0) break;

        if (page.documents.length > 0) {
          // This task runs inside the core cron request, so the request's plugin
          // is not the owner. Stamp the registering plugin on any document that
          // did not name one, or a rebuild would relabel it as core.
          await search.bulkIndex(
            page.documents.map(document => ({
              ...document,
              pluginId:
                searchDocumentOwner(document.pluginId) ?? indexer.pluginId,
            })),
          );
        }

        offset += page.itemsRead;
      }
    }
  },
});
