import "server-only";
import { revalidateTag, updateTag } from "next/cache";

import type {
  ContentInvalidationInput,
  ContentInvalidationMode,
} from "../cache";

import { contentInvalidationTags } from "../cache";

export type { ContentInvalidationMode };

/**
 * Where the call is coming from, which decides *how* `immediate` is done.
 *
 * `updateTag` buys read-your-own-writes and is Server-Action-only. A Route
 * Handler cannot call it - but `revalidateTag(tag, { expire: 0 })` expires a
 * tag immediately there, which is the documented path for a webhook. Same
 * guarantee for the next reader either way, so the caller names its context and
 * gets the strongest option available to it.
 */
export type ContentInvalidationContext = "route-handler" | "server-action";

/**
 * Expires the public cache entries one mutation actually affected.
 *
 * The **only** module in the Content Engine that imports `next/cache`, and the
 * reason the tag builders are pure strings a directory up: `content/` and
 * `content/server/` are loaded by `apps/api` (a plain `@hono/node-server`
 * process) and by drizzle-kit, where `next/cache` throws on import.
 *
 * Call it from a server action, after the write has returned. Not from the
 * service: a service call may be inside a transaction that has not committed,
 * may be running outside Next entirely, and has no request scope for the Next
 * cache APIs to attach to. A direct caller invalidates for itself, after it
 * commits.
 *
 * `mode` defaults to `immediate`, because the mutations that matter most are
 * the ones that *remove* something. Stale-while-revalidate would keep serving
 * an unpublished post, a deleted one, or a URL that has moved - for one more
 * request each, which is exactly one too many. Pass
 * `stale-while-revalidate` for an edit that only changed what a published,
 * still-reachable page says; that response is safe to serve once more, and
 * keeping the cache warm is worth more than a few seconds of freshness.
 *
 * `context` defaults to `server-action`, which is where every generated write
 * path already lives. Background work reaches this through the
 * [revalidation bridge](../server/revalidate-bridge.ts), which lands in a Route
 * Handler and says so.
 */
export const revalidateContent = (
  input: ContentInvalidationInput,
  options?: {
    context?: ContentInvalidationContext;
    mode?: ContentInvalidationMode;
  },
): void => {
  const mode = options?.mode ?? "immediate";
  const context = options?.context ?? "server-action";

  for (const tag of contentInvalidationTags(input)) {
    if (mode !== "immediate") {
      revalidateTag(tag, "max");
      continue;
    }

    if (context === "server-action") {
      updateTag(tag);
      continue;
    }

    // `updateTag` throws outside a Server Action. `expire: 0` is the documented
    // equivalent for a webhook: the entry is expired now rather than served
    // stale once more.
    revalidateTag(tag, { expire: 0 });
  }
};
