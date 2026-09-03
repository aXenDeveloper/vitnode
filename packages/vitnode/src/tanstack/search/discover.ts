import type { SearchFeedParams } from "@/views/search/search-feed-query";

import { feedQueryKey, feedQueryOptions } from "./feed";

/**
 * Discover is the *browse* feed: no term, newest first. A term search is a
 * different request with a different sort, and it is not this module's.
 */
export const DISCOVER_FEED_SORT = "newest" as const;

export const DISCOVER_FEED_PARAMS: SearchFeedParams = Object.freeze({
  sort: DISCOVER_FEED_SORT,
});

export const discoverFeedQueryKey = (locale: string) =>
  feedQueryKey({ locale, params: DISCOVER_FEED_PARAMS });

/** The Discover feed, as the one query definition every caller shares. */
export const discoverFeedQueryOptions = ({ locale }: { locale: string }) =>
  feedQueryOptions({ locale, params: DISCOVER_FEED_PARAMS });
