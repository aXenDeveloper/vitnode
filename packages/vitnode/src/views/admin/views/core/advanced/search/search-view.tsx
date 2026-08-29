import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { fetcher } from "@/lib/fetcher";

import { getContentCollectionLabels } from "./collection-label";
import { searchIndexStatusRequest } from "./search-index-query";
import { SearchIndexView } from "./search-index-view";

export { SearchAdminViewSkeleton } from "./search-index-content";

/**
 * The Next.js half of `/admin/core/advanced/search`: read the status and the
 * content-type labels, then hand them to the shared screen.
 *
 * A Server Component, so `fetcher()` reads the admin cookie through
 * `next/headers` and `getContentCollectionLabels()` reads the frontend
 * content-type registry - which is server-side config, and the one thing on this
 * screen a browser cannot resolve for itself.
 *
 * The request is `searchIndexStatusRequest`'s, the same object the TanStack
 * Start loader sends. The two mutations are bound by `SearchIndexView`, one
 * component down, because they need `useRouter`.
 */
export const SearchAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) => {
  const [res, labels, query] = await Promise.all([
    fetcher(debugAdminModule, searchIndexStatusRequest),
    getContentCollectionLabels(),
    searchParams,
  ]);

  const data = await res.json();

  return <SearchIndexView data={data} labels={labels} search={query.search} />;
};
