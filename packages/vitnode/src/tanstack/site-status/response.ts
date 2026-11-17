import { createIsomorphicFn } from "@tanstack/react-start";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";

/**
 * Answers the current SSR request as an offline page: `503` (so search
 * engines keep the old copy and the page cache never stores it), no indexing,
 * no caching, and `Retry-After` when the opening time is known. A no-op in the
 * browser.
 */
export const markSiteOfflineResponse = createIsomorphicFn()
  .server((opensAt: null | string) => {
    try {
      setResponseStatus(503);
      setResponseHeader("cache-control", "no-store");
      setResponseHeader("x-robots-tag", "noindex");
      const seconds = opensAt
        ? Math.ceil((Date.parse(opensAt) - Date.now()) / 1000)
        : 0;
      if (seconds > 0) setResponseHeader("retry-after", String(seconds));
    } catch {
      // Outside a request (a prerender at build time) there is no response.
    }
  })
  .client(() => undefined);
