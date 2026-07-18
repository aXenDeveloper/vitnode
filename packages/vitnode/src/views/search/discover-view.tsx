import { searchModule } from "@/api/modules/search/search.module";
import { fetcher } from "@/lib/fetcher";

import type { SearchFeedPage } from "./types";

import { SearchFeed } from "./search-feed";

export const DiscoverView = async () => {
  const res = await fetcher(searchModule, {
    module: "search",
    path: "/",
    method: "get",
    args: {
      query: { sort: "newest", first: "20" },
    },
  });
  const initialData = (await res.json()) as SearchFeedPage;

  return (
    <SearchFeed
      initialData={initialData}
      params={{ sort: "newest" }}
      variant="timeline"
    />
  );
};
