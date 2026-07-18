import { searchModule } from "@/api/modules/search/search.module";
import { fetcher } from "@/lib/fetcher";

import type { SearchFeedParams } from "./search-feed";
import type { SearchFeedPage } from "./types";

import { SearchControls } from "./search-controls";

export const SearchView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search : undefined;
  const sort = search ? "relevance" : "newest";
  const defaultParams: SearchFeedParams = { search, sort };

  const res = await fetcher(searchModule, {
    module: "search",
    path: "/",
    method: "get",
    args: {
      query: { ...(search ? { search } : {}), sort, first: "20" },
    },
  });
  const initialData = (await res.json()) as SearchFeedPage;

  return <SearchControls defaultParams={defaultParams} initialData={initialData} />;
};
