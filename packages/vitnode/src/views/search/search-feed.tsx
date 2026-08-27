"use client";

import { useLocale } from "next-intl";

import { Link } from "@/lib/navigation";

import type {
  SearchFeedLinkProps,
  SearchFeedVariant,
} from "./search-feed-content";
import type { SearchFeedParams } from "./search-feed-query";
import type { SearchFeedPage } from "./types";

import { SearchFeedContent } from "./search-feed-content";
import { searchFeedQueryOptions } from "./search-feed-query";

export type { SearchFeedParams, SearchFeedVariant };

/**
 * The feed's link, the Next.js way: `next-intl`'s locale-aware `Link`.
 *
 * Declared at module scope rather than inline, so it is the same component type
 * on every render and React reconciles rather than remounting each result.
 */
const NextSearchFeedLink = ({
  children,
  className,
  href,
}: SearchFeedLinkProps) => (
  <Link className={className} href={href}>
    {children}
  </Link>
);

/**
 * {@link SearchFeedContent}, wired to Next.js.
 *
 * Everything the feed does lives in the shared component; this supplies the
 * three things that cannot be shared, and the props are unchanged, so
 * `SearchControls`, `DiscoverView` and the AdminCP user timeline see exactly the
 * component they always did.
 *
 * - **The locale**, which `next-intl` reads from Next's request scope.
 * - **A `Link`** that knows how to write a locale prefix into an internal href.
 * - **The query**, built here from `searchFeedQueryOptions` - the same factory
 *   a TanStack Start route loader uses, with the same request, cursor rule and
 *   status checking. Only the transport differs, and this app takes the default:
 *   the browser's fetcher, which is the right one for a client component.
 *
 * `initialData` stays supported because Next.js has nowhere else to put a page
 * it already fetched: `DiscoverView` and `SearchView` render the first page in a
 * Server Component and hand it down, with no Query cache to hydrate from. An app
 * that *does* hydrate one must not use it - see `searchFeedQueryOptions`.
 *
 * The options object is rebuilt on every render, deliberately. `SearchControls`
 * derives `params` from component state as the visitor types, so memoising on it
 * would be memoising on a value that changes anyway - and Query hashes the key
 * structurally, so an equal object is the same cache entry.
 */
export const SearchFeed = ({
  initialData,
  params,
  variant = "list",
}: {
  initialData?: SearchFeedPage;
  params: SearchFeedParams;
  variant?: SearchFeedVariant;
}) => {
  const locale = useLocale();

  return (
    <SearchFeedContent
      LinkComponent={NextSearchFeedLink}
      queryOptions={searchFeedQueryOptions({ initialData, locale, params })}
      variant={variant}
    />
  );
};
