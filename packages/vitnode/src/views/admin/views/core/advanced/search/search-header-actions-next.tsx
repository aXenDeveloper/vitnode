"use client";

import { useSearchIndexActionsNext } from "./search-actions-next";
import { SearchHeaderActions } from "./search-header-actions";

/**
 * The header's "rebuild everything" button, with Next.js's mutation bound to it.
 *
 * Its own component for the same reason `SearchIndexView` is: the mutation ends
 * in `router.refresh()`, and the page that renders this button in its header is
 * a Server Component.
 */
export const SearchHeaderActionsNext = () => (
  <SearchHeaderActions onRebuild={useSearchIndexActionsNext().rebuild} />
);
