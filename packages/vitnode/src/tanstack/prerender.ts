import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { PAGE_CACHE_RENDER_HEADER } from "@/page-cache/tags";

const PRERENDER_REQUEST_HEADER = "x-nitro-prerender";

export const isPrerenderRequest = createIsomorphicFn()
  .server(() => {
    try {
      return getRequestHeader(PRERENDER_REQUEST_HEADER) !== undefined;
    } catch {
      return false;
    }
  })
  .client(() => false);

/**
 * Whether this render's HTML is shared by every visitor: a prerender written
 * to a file at build time, or a page the HTML cache renders once and stores.
 * Either way it must not contain the visitor's session - the browser loads
 * the account UI after hydration.
 */
export const isSharedRenderRequest = createIsomorphicFn()
  .server(() => {
    try {
      return (
        getRequestHeader(PRERENDER_REQUEST_HEADER) !== undefined ||
        getRequestHeader(PAGE_CACHE_RENDER_HEADER) !== undefined
      );
    } catch {
      return false;
    }
  })
  .client(() => false);
