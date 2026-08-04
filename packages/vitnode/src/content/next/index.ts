/**
 * Universal Content Engine - Next.js surface.
 *
 * The only place in the engine that imports `next/*`. Everything here carries
 * `server-only`, so it can never be reached from a client component - and it
 * must never be imported from `content/` or `content/server/`, which
 * `apps/api` and drizzle-kit both load in plain Node.
 *
 * The cache *tags* live in `@vitnode/core/content`, because they are strings.
 */
export { contentPublicFetch, contentPublicItemTags } from "./fetch.server";
export type { ContentPublicFetchResult } from "./fetch.server";
export { revalidateContent } from "./revalidate.server";
export type { ContentInvalidationMode } from "./revalidate.server";
