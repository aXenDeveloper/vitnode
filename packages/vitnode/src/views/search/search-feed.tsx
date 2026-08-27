"use client";

import { useLocale } from "next-intl";

import { Link } from "@/lib/navigation";

import type {
  SearchFeedLinkProps,
  SearchFeedParams,
  SearchFeedVariant,
} from "./search-feed-content";
import type { SearchFeedPage } from "./types";

import { SearchFeedContent } from "./search-feed-content";

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
 * Everything the feed does lives in the shared component; this supplies the two
 * things that cannot be shared - the locale, which `next-intl` reads from Next's
 * request scope, and a `Link` that knows how to write a locale prefix into an
 * internal href. The props are unchanged, so `SearchControls` and `DiscoverView`
 * see exactly the component they always did.
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
      initialData={initialData}
      LinkComponent={NextSearchFeedLink}
      locale={locale}
      params={params}
      variant={variant}
    />
  );
};
