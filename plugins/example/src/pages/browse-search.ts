/** How many items the page shows, and what `page` is an index into. */
export const BROWSE_PAGE_SIZE = 3;

/** The last page there is anything to show on. */
export const BROWSE_LAST_PAGE = 3;

export interface BrowseSearch {
  page: number;
}

export const browseSearch = (input: Record<string, unknown>): BrowseSearch => {
  const raw = input.page;
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return { page: 1 };

  return { page: Math.min(Math.max(Math.trunc(parsed), 1), BROWSE_LAST_PAGE) };
};
