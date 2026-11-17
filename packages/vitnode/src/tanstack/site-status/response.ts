import { createIsomorphicFn } from "@tanstack/react-start";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";
import { retryAfterSeconds } from "@vitnode/api/lib/site-status";

/**
 * Answers the current SSR request as an offline page: `503` (so search
 * engines keep the old copy and the page cache never stores it), no indexing,
 * no caching, and `Retry-After` when the opening time is known. A no-op in the
 * browser.
 */
export const markSiteOfflineResponse = createIsomorphicFn()
  .server((opensAt: null | string) => {
    setResponseStatus(503);
    setResponseHeader("cache-control", "no-store");
    setResponseHeader("x-robots-tag", "noindex");
    const retryAfter = retryAfterSeconds(opensAt);
    if (retryAfter) setResponseHeader("retry-after", String(retryAfter));
  })
  .client(() => undefined);
