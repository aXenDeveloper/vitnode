import { getLocale } from "next-intl/server";

import { fetchSearchFeed } from "./fetch-feed";
import { SearchFeed } from "./search-feed";

export const DiscoverView = async () => {
  const locale = await getLocale();
  const initialData = await fetchSearchFeed({ locale });

  return (
    <SearchFeed
      initialData={initialData}
      params={{ sort: "newest" }}
      variant="timeline"
    />
  );
};
