import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

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
