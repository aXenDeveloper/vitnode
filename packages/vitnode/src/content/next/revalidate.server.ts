import "server-only";
import { revalidateTag, updateTag } from "next/cache";

import type { ContentInvalidationInput } from "../cache";

import { contentInvalidationTags } from "../cache";

/**
 * How hard a mutation expires the tags it touched.
 *
 * - `immediate` - `updateTag`. The next request waits for fresh data; no stale
 *   response is served at all. **Server Actions only**, which is where every
 *   generated write path already lives.
 * - `stale-while-revalidate` - `revalidateTag(tag, "max")`. The cached response
 *   is served once more while the new one is fetched behind it. Cheaper, and
 *   callable from a Route Handler.
 */
export type ContentInvalidationMode = "immediate" | "stale-while-revalidate";

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
 * @throws if `immediate` is used outside a Server Action - `updateTag` is
 * Server-Action-only. From a Route Handler or a webhook, pass
 * `stale-while-revalidate`.
 */
export const revalidateContent = (
  input: ContentInvalidationInput,
  options?: { mode?: ContentInvalidationMode },
): void => {
  const mode = options?.mode ?? "immediate";

  for (const tag of contentInvalidationTags(input)) {
    if (mode === "immediate") {
      updateTag(tag);
      continue;
    }

    revalidateTag(tag, "max");
  }
};
