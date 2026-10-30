import { and, asc, gt, inArray } from "drizzle-orm";

import type { AnyContentModel } from "@/content/server/model";

import { buildCron } from "@/api/lib/cron";
import { searchItemIdFromKey } from "@/api/models/search";
import { contentAccessSourceOf } from "@/content/access/server/source";
import { core_search_index } from "@/database/search";

const BATCH = 500;
const MAX_BATCHES = 20;
const CURSOR_KEY = "content:search-access:cursor";

/**
 * Walks the search index a slice at a time and re-stamps the access scopes of
 * every document whose record moved since it was indexed - a write whose
 * search sync failed, a dependent the live path did not reach. Search results
 * are checked against the content tables on every query, so this never
 * decides who sees what; it keeps the index's own filter, and its counts,
 * close to the truth.
 */
export const contentSearchAccessCron = buildCron({
  name: "content-search-access",
  description:
    "Re-check the access scopes stored in the search index against the content they belong to, and correct the ones that drifted.",
  // Hourly, off the hour.
  schedule: "41 * * * *",
  handler: async c => {
    const models = (
      (c.get("core")?.contentModels ?? []) as { model: AnyContentModel }[]
    )
      .map(entry => entry.model)
      .filter(model => contentAccessSourceOf(c, model));
    if (models.length === 0) return;

    const itemTypes = models.map(model => model.definition.id);
    const cache = c.get("cache");
    let cursor = Number((await cache.getSystem<string>(CURSOR_KEY)) ?? 0) || 0;
    let corrected = 0;

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const rows = await c
        .get("db")
        .select({
          id: core_search_index.id,
          itemId: core_search_index.itemId,
          itemType: core_search_index.itemType,
        })
        .from(core_search_index)
        .where(
          and(
            inArray(core_search_index.itemType, itemTypes),
            gt(core_search_index.id, cursor),
          ),
        )
        .orderBy(asc(core_search_index.id))
        .limit(BATCH);

      if (rows.length === 0) {
        cursor = 0;
        break;
      }

      const contentTypes = c.get("core")?.contentTypes ?? [];
      corrected += await c.get("search").refreshAccessScopes(
        rows.map(row => ({
          itemId: searchItemIdFromKey(contentTypes, row.itemType, row.itemId),
          itemType: row.itemType,
        })),
      );
      cursor = rows.at(-1)?.id ?? cursor;
      if (rows.length < BATCH) {
        cursor = 0;
        break;
      }
    }

    await cache.setSystem(CURSOR_KEY, String(cursor));
    if (corrected > 0) {
      await c
        .get("log")
        .debug(
          `[content-search-access] corrected the access scopes of ${corrected} search documents.`,
        );
    }
  },
});
