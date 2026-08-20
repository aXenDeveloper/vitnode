/**
 * Cache tags for core's own Next.js cache entries.
 *
 * Pure strings and no `next/*` import, for the same reason the Content Engine's
 * [tag builders](../content/cache.ts) are: a Server Action has to name a tag to
 * expire it, an app has to name the same tag to have its own `"use cache"`
 * functions expire alongside core's, and neither should have to reach into a
 * server-only module to spell one.
 *
 * Content has its own family of tags (`content:*`) built per content type. These
 * are the handful core owns outright.
 */

/**
 * The public search feed - what `/search` and `/discover` render before anyone
 * types a term.
 *
 * One tag rather than one per locale: the feed is rebuilt wholesale by
 * `rebuildSearchIndex`, which re-indexes every language at once, so a per-locale
 * tag would buy nothing and only add strings to expire. Term searches are not
 * cached at all and so are not tagged - see `views/search/fetch-feed.ts`.
 */
export const SEARCH_FEED_TAG = "core:search:feed";
