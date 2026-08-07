import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  like,
  max,
  ne,
} from "drizzle-orm";
import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { searchDocumentOwner } from "@/api/models/search";
import { CONFIG_PLUGIN } from "@/config";
import { core_logs } from "@/database/logs";
import { core_search_index } from "@/database/search";

const CONTENT_SEARCH_LOG_PREFIX = "[content-search]";

const SYNC_ERROR_LIMIT = 10;

const collectionSchema = z.object({
  /**
   * Index rows, counting one per language.
   *
   * Separate from `indexed`, which counts distinct items: multi-language content
   * is indexed once per translation, so its coverage has to be measured in
   * documents or a fully-indexed collection would read as 33%.
   */
  documents: z.number(),
  /**
   * Whether an indexer is registered for this item type *right now*. A stored
   * plugin owner does not imply one: the plugin may be uninstalled, renamed, or
   * simply not loaded in this process.
   */
  hasIndexer: z.boolean(),
  indexed: z.number(),
  itemType: z.string(),
  /**
   * One entry per language present in the index, newest first by count.
   *
   * Empty for a collection that is entirely language-agnostic. It is what makes
   * "Polish is missing 40 documents" visible at all - a single total cannot say
   * which language a rebuild failed halfway through.
   */
  languages: z.array(
    z.object({
      documents: z.number(),
      languageCode: z.string(),
      lastIndexedAt: z.date().nullable(),
    }),
  ),
  lastIndexedAt: z.date().nullable(),
  pluginId: z.string(),
  /** Source items the indexer reports. `null` when there is no indexer to ask. */
  total: z.number().nullable(),
});

const syncErrorSchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.number(),
  pluginId: z.string(),
});

export const searchStatusDebugAdminRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  adminStaffPermission: { module: "system", permission: "can_view" },
  route: {
    method: "get",
    description:
      "Report the active search engine, its health, and per-collection index coverage.",
    path: "/search/status",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              collections: z.array(collectionSchema),
              engine: z.string(),
              hasCronAdapter: z.boolean(),
              healthy: z.boolean(),
              lastIndexedAt: z.date().nullable(),
              syncErrors: z.array(syncErrorSchema),
              total: z.number(),
            }),
          },
        },
        description: "Search engine status",
      },
    },
  },
  handler: async c => {
    const db = c.get("db");
    const search = c.get("search");
    const core = c.get("core");

    // One item can emit several index rows (e.g. one per language), so coverage
    // is measured in distinct items - not documents.
    //
    // `pluginId` comes along so a collection whose indexer is gone can still name
    // its owner. An item type has one owner, so the aggregate is a formality -
    // `max` picks deterministically if rows ever disagree mid-rebuild.
    const indexedByType = await db
      .select({
        itemType: core_search_index.itemType,
        documents: count(),
        indexed: countDistinct(core_search_index.itemId),
        lastIndexedAt: max(core_search_index.indexedAt),
        pluginId: max(core_search_index.pluginId),
      })
      .from(core_search_index)
      .groupBy(core_search_index.itemType);

    const statsByType = new Map(indexedByType.map(row => [row.itemType, row]));

    // Per language, so a rebuild that stopped halfway through one locale is
    // visible as that locale rather than as a slightly-low total. The
    // language-agnostic rows (`""`) are dropped: they are not a language, and
    // listing them as one would put an unnamed row in every collection.
    const byLanguage = await db
      .select({
        itemType: core_search_index.itemType,
        documents: count(),
        languageCode: core_search_index.languageCode,
        lastIndexedAt: max(core_search_index.indexedAt),
      })
      .from(core_search_index)
      .where(ne(core_search_index.languageCode, ""))
      .groupBy(core_search_index.itemType, core_search_index.languageCode)
      .orderBy(desc(count()));

    const languagesByType = new Map<
      string,
      { documents: number; languageCode: string; lastIndexedAt: Date | null }[]
    >();
    for (const row of byLanguage) {
      const entries = languagesByType.get(row.itemType) ?? [];
      entries.push({
        documents: row.documents,
        languageCode: row.languageCode,
        lastIndexedAt: row.lastIndexedAt,
      });
      languagesByType.set(row.itemType, entries);
    }

    // Newest first, and bounded: this is a "what went wrong lately" panel, not a
    // log viewer. `LIKE 'prefix%'` needs no escaping - the prefix contains
    // neither `%` nor `_`.
    const syncErrors = await db
      .select({
        id: core_logs.id,
        pluginId: core_logs.pluginId,
        content: core_logs.content,
        createdAt: core_logs.createdAt,
      })
      .from(core_logs)
      .where(
        and(
          eq(core_logs.type, "error"),
          like(core_logs.content, `${CONTENT_SEARCH_LOG_PREFIX}%`),
        ),
      )
      .orderBy(desc(core_logs.id))
      .limit(SYNC_ERROR_LIMIT);

    // Start from every registered indexer so a collection with nothing indexed
    // yet still appears; then fold in any indexed type without a live indexer.
    const itemTypes = [
      ...new Set([
        ...core.searchIndexers.map(indexer => indexer.itemType),
        ...indexedByType.map(row => row.itemType),
      ]),
    ];

    const collections = await Promise.all(
      itemTypes.map(async itemType => {
        const indexer = core.searchIndexers.find(i => i.itemType === itemType);
        const stats = statsByType.get(itemType);
        const indexed = stats?.indexed ?? 0;
        // No indexer, no source count - and inventing `total = indexed` would
        // report a collection nothing can rebuild as fully covered. An indexer
        // without the optional `count` still falls back to the indexed count,
        // which is the documented behaviour of leaving `count` out.
        //
        // `hasIndexer` says only whether a rebuild indexer exists. A plugin may
        // keep its collection current through `search.index()` and register none,
        // so this is not a statement about the plugin.
        const total = indexer ? ((await indexer.count?.(c)) ?? indexed) : null;

        return {
          hasIndexer: indexer !== undefined,
          itemType,
          // The registered indexer is canonical - it is what the next rebuild
          // will stamp on the rows. Falling back to the stored owner is what
          // stops a collection with no indexer being reassigned to core, and
          // `"unknown"` is honest when neither source knows.
          pluginId:
            indexer?.pluginId ??
            searchDocumentOwner(stats?.pluginId) ??
            "unknown",
          documents: stats?.documents ?? 0,
          indexed,
          languages: languagesByType.get(itemType) ?? [],
          // Reported as measured, even when it is below `indexed`: more documents
          // than source records is a stale index, and raising the source count to
          // hide it is how that goes unnoticed. The UI clamps the bar instead.
          total,
          lastIndexedAt: stats?.lastIndexedAt ?? null,
        };
      }),
    );

    const lastIndexedAt = collections.reduce<Date | null>((latest, row) => {
      if (!row.lastIndexedAt) return latest;

      return !latest || row.lastIndexedAt > latest ? row.lastIndexedAt : latest;
    }, null);

    return c.json({
      collections,
      engine: search.name(),
      hasCronAdapter: core.hasCronAdapter,
      healthy: await search.ping(),
      lastIndexedAt,
      syncErrors,
      total: collections.reduce((sum, row) => sum + row.indexed, 0),
    });
  },
});
