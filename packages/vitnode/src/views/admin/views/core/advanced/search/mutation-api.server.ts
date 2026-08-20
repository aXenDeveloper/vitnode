"use server";

import { updateTag } from "next/cache";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { SEARCH_FEED_TAG } from "@/lib/cache-tags";
import { fetcher } from "@/lib/fetcher";

export const rebuildSearchIndexMutation = async (itemType?: string) => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/search/rebuild",
    method: "post",
    module: "debug",
    args: {
      body: itemType ? { itemType } : {},
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  const data = await res.json();

  // The public browse feed is a cached read of this index. Expiring it here is
  // what makes a rebuild visible on `/search` and `/discover` without waiting
  // out its `cacheLife`. `updateTag` rather than `revalidateTag` because this is
  // a Server Action: the admin who pressed the button sees the new feed on the
  // refresh it triggers, not one navigation later.
  updateTag(SEARCH_FEED_TAG);

  return { data };
};

/**
 * Removes the documents of a collection with no rebuild indexer. Destructive:
 * nothing *rebuilds* them afterwards, though the owning plugin may write them
 * again live. The API refuses it for any collection that has an indexer.
 */
export const clearSearchCollectionMutation = async (itemType: string) => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/search/clear",
    method: "post",
    module: "debug",
    args: {
      body: { itemType },
    },
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  const data = await res.json();

  // Documents just disappeared from the index; the feed must stop listing them.
  updateTag(SEARCH_FEED_TAG);

  return { data };
};
