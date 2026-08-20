import "server-only";

import type { CacheExpiryContext } from "../../framework/cache/types";
import type {
  ContentInvalidationInput,
  ContentInvalidationMode,
} from "../cache";

import { expireCacheTags } from "../../framework/cache";
import { contentInvalidationTags } from "../cache";

export type { ContentInvalidationMode };

/**
 * Where the call is coming from, which decides *how* `immediate` is done.
 *
 * An alias of the framework-independent {@link CacheExpiryContext}: which
 * primitive a mutation handler may reach for that a webhook may not is a
 * framework question, so the adapter answers it and this layer only reports the
 * truth about itself. The name stays because it is public API.
 */
export type ContentInvalidationContext = CacheExpiryContext;

/**
 * Expires the public cache entries one mutation actually affected.
 *
 * Two pure steps and nothing else: `contentInvalidationTags` says *which*
 * entries the mutation reached, and {@link expireCacheTags} expires them through
 * whichever cache adapter is installed. Neither step names a Next function - the
 * mapping from (`mode`, `context`) onto `updateTag` or `revalidateTag` lives in
 * [the adapter](../../framework/cache/next.ts), which is the only module in the
 * package that imports `next/cache`.
 *
 * It still lives under `content/next/` and still carries `server-only`, because
 * that is what its callers are: it must never be reached from `content/` or
 * `content/server/`, which `apps/api` (a plain `@hono/node-server` process) and
 * drizzle-kit both load in plain Node.
 *
 * Call it from a server action, after the write has returned. Not from the
 * service: a service call may be inside a transaction that has not committed,
 * may be running outside Next entirely, and has no request scope for the cache
 * APIs to attach to. A direct caller invalidates for itself, after it commits.
 *
 * The two options are handed to {@link expireCacheTags} untouched rather than
 * defaulted here, so there is one place a default can be read and one place it
 * can be wrong.
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
  expireCacheTags(contentInvalidationTags(input), options);
};
