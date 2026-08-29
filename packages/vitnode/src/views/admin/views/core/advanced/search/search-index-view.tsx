"use client";

import { NextDataTableNavigation } from "@/components/table/navigation-next";

import type { SearchIndexStatus } from "./search-index-query";

import { useSearchIndexActionsNext } from "./search-actions-next";
import { SearchIndexContent } from "./search-index-content";

/**
 * The shared search-index screen, with Next.js's mutations bound to it.
 *
 * Two lines of glue, and it exists because of one constraint: the mutations need
 * `router.refresh()`, `useRouter` needs a component, and `SearchAdminView` is a
 * Server Component. So the binding happens here, on the client, and the server
 * half above stays free of it.
 *
 * `NextDataTableNavigation` is mounted here rather than inherited, because the
 * collections table renders `ContentDataTable` - the half that has no idea how
 * to change a URL. It is the same provider `DataTable` used to mount for it, so
 * the search box behaves exactly as it did.
 */
export const SearchIndexView = ({
  data,
  labels,
  search,
}: {
  data: SearchIndexStatus;
  labels?: Map<string, string>;
  search?: string;
}) => (
  <NextDataTableNavigation>
    <SearchIndexContent
      actions={useSearchIndexActionsNext()}
      data={data}
      labels={labels}
      search={search}
    />
  </NextDataTableNavigation>
);
