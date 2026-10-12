import type { Context } from "hono";

import {
  encodePageCacheTags,
  PAGE_CACHE_TAGS_HEADER,
} from "../../page-cache/tags";

export {
  invalidatePageCacheTags,
  type PageCacheInvalidationMode,
  type PageCacheInvalidationResult,
} from "../../page-cache/store.server";

/**
 * Names the data this response was built from. A cached page that reads it
 * during its render is stored with these tags, and `invalidatePageCacheTags`
 * with any of them invalidates that page.
 */
export const setPageCacheTags = (c: Context, tags: readonly string[]): void => {
  const encoded = encodePageCacheTags(tags);
  if (encoded !== "") c.header(PAGE_CACHE_TAGS_HEADER, encoded);
};
