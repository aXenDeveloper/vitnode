import { getLocale } from "next-intl/server";

import type { SearchFeedParams } from "./search-feed";

import { fetchSearchFeed } from "./fetch-feed";
import { SearchControls } from "./search-controls";

export const SearchView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const query = await searchParams;
  const locale = await getLocale();
  const search = typeof query.search === "string" ? query.search : undefined;
  const sort = search ? "relevance" : "newest";
  const defaultParams: SearchFeedParams = { search, sort };

  const initialData = await fetchSearchFeed({ locale, search });

  return (
    <SearchControls defaultParams={defaultParams} initialData={initialData} />
  );
};
