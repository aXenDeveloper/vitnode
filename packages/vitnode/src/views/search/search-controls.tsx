"use client";

import { useLocale } from "next-intl";

import type { SearchFeedParams } from "./search-feed-query";
import type { SearchFeedPage } from "./types";

import { SearchControlsContent } from "./search-controls-content";
import { NextSearchFeedLink } from "./search-feed";
import { searchFeedQueryOptions } from "./search-feed-query";

/**
 * {@link SearchControlsContent}, wired to Next.js.
 *
 * Everything the search page *does* lives in the shared component; this supplies
 * the three things that cannot be shared, and the props are unchanged, so
 * `SearchView` sees exactly the component it always did.
 *
 * - **The locale**, which `next-intl` reads from Next's request scope.
 * - **A `Link`** that knows how to write a locale prefix into an internal href -
 *   the same one `SearchFeed` hands the feed.
 * - **The query**, built from `searchFeedQueryOptions` per set of parameters, on
 *   the browser's transport. That is the default and the right one here: this is
 *   a client component, and `fetchNextPage` runs in the browser either way.
 *
 * `initialData` stays supported because Next.js has nowhere else to put a page it
 * already fetched: `SearchView` renders the first page in a Server Component and
 * hands it down, with no Query cache to hydrate from. An app that *does* hydrate
 * one must not use it - see `searchFeedQueryOptions`, and `routes/search.tsx` in
 * `apps/web` for the shape that does.
 */
export const SearchControls = ({
  defaultParams,
  initialData,
}: {
  defaultParams: SearchFeedParams;
  initialData?: SearchFeedPage;
}) => {
  const locale = useLocale();

  return (
    <SearchControlsContent
      defaultParams={defaultParams}
      feedQuery={params =>
        searchFeedQueryOptions({ initialData, locale, params })
      }
      LinkComponent={NextSearchFeedLink}
      variant="timeline"
    />
  );
};
