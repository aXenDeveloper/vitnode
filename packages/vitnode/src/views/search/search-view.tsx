import { getLocale } from "next-intl/server";

import { fetchSearchFeed } from "./fetch-feed";
import { SearchControls } from "./search-controls";
import { normalizeSearchTerm, searchFeedParamsFor } from "./search-params";

/**
 * The search page, the Next.js way: the first page fetched on the server and
 * handed to the controls as `initialData`.
 *
 * The term and the sort it implies come from `./search-params`, which is also
 * what the TanStack Start route at `apps/web/src/routes/_main/search.tsx` reads its
 * own search schema through - so `/search?search=hello` means the same request
 * in both applications rather than in two hand-written approximations of it.
 */
export const SearchView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const query = await searchParams;
  const locale = await getLocale();
  const search = normalizeSearchTerm(query.search);
  const defaultParams = searchFeedParamsFor({ search });

  const initialData = await fetchSearchFeed({ locale, search });

  return (
    <SearchControls defaultParams={defaultParams} initialData={initialData} />
  );
};
