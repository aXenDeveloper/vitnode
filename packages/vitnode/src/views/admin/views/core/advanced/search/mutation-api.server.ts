"use server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
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

  return { data: await res.json() };
};

/**
 * Removes the documents of an orphaned collection. Destructive, and nothing puts
 * them back - the API refuses it for any collection that still has an indexer.
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

  return { data: await res.json() };
};
