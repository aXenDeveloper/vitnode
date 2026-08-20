import "server-only";

import { searchModule } from "@/api/modules/search/search.module";
import { setCacheEntryLife, tagCacheEntry } from "@/framework/cache";
import { awaitRequest } from "@/framework/request";
import { SEARCH_FEED_TAG } from "@/lib/cache-tags";
import { fetcher } from "@/lib/fetcher";
import { coreFetcher } from "@/lib/fetcher/core";

import type { SearchFeedPage } from "./types";

/** How many hits the first server-rendered page holds. */
const FEED_PAGE_SIZE = "20";

/**
 * The browse feed: no term, newest first, one language.
 *
 * Cached, and it is the only search read that is. The arguments are a closed
 * set - one entry per enabled locale - the response is identical for every
 * visitor (the route resolves it with `includePrivate: false` and never looks at
 * the user), and it is the page crawlers and first-time visitors land on. That
 * is the whole shape a shared cache wants.
 *
 * A *term* search is none of those things: the key space is whatever anyone
 * types, so caching it would fill the store with entries that are read once. It
 * stays dynamic - see {@link fetchSearchFeed}.
 *
 * `coreFetcher` rather than `fetcher`, because `fetcher` forwards the request's
 * cookies and `x-forwarded-for` and `"use cache"` cannot enclose a runtime read.
 * Nothing on this route is per-visitor, so there is nothing to forward.
 */
const fetchCachedFeed = async (locale: string): Promise<SearchFeedPage> => {
  "use cache";
  setCacheEntryLife("minutes");
  tagCacheEntry(SEARCH_FEED_TAG);

  const res = await coreFetcher(searchModule, {
    module: "search",
    path: "/",
    method: "get",
    args: {
      query: { sort: "newest", first: FEED_PAGE_SIZE, lang: locale },
    },
  });

  return await res.json();
};

const fetchLiveFeed = async ({
  locale,
  search,
}: {
  locale: string;
  search: string;
}): Promise<SearchFeedPage> => {
  const res = await fetcher(searchModule, {
    module: "search",
    path: "/",
    method: "get",
    args: {
      query: {
        search,
        sort: "relevance",
        first: FEED_PAGE_SIZE,
        lang: locale,
      },
    },
  });

  return await res.json();
};

export const fetchSearchFeed = async ({
  locale,
  search,
}: {
  locale: string;
  search?: string;
}): Promise<SearchFeedPage> => {
  if (search !== undefined && search !== "") {
    return await fetchLiveFeed({ locale, search });
  }

  await awaitRequest();

  return await fetchCachedFeed(locale);
};
