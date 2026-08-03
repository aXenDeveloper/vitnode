import "server-only";
import { revalidateTag } from "next/cache";

import type { ContentInvalidationInput } from "../cache";

import { contentInvalidationTags } from "../cache";

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
 * may be running outside Next entirely, and has no request scope for
 * `revalidateTag` to attach to. A direct caller invalidates for itself, after
 * it commits.
 */
export const revalidateContent = (input: ContentInvalidationInput): void => {
  for (const tag of contentInvalidationTags(input)) {
    // The two-argument form: a profile is required for stale-while-revalidate,
    // and `max` is right here because a tag is only expired when the underlying
    // row actually changed.
    revalidateTag(tag, "max");
  }
};
