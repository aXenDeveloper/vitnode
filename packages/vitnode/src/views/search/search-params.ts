import type { SearchFeedParams } from "./search-feed-query";

export const MIN_SEARCH_TERM_LENGTH = 3;

export const MAX_SEARCH_TERM_LENGTH = 256;

/** How long the controls wait after a keystroke before searching. */
export const SEARCH_TERM_DEBOUNCE_MS = 500;

/**
 * Every order results can come back in - the same three the API's `sort` enum
 * accepts, in the order the sort control lists them.
 */
export const SEARCH_SORT_VALUES = ["relevance", "newest", "oldest"] as const;

export type SearchSort = (typeof SEARCH_SORT_VALUES)[number];

/** The order a feed with no term comes back in: there is nothing to rank by. */
export const BROWSE_SEARCH_SORT: SearchSort = "newest";

/** The order a feed *with* a term comes back in. */
export const TERM_SEARCH_SORT: SearchSort = "relevance";

/** Narrows a URL parameter, a `<select>` value or a stored preference. */
export const isSearchSort = (value: unknown): value is SearchSort =>
  typeof value === "string" &&
  (SEARCH_SORT_VALUES as readonly string[]).includes(value);

export const normalizeSearchTerm = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const term = value.trim().slice(0, MAX_SEARCH_TERM_LENGTH).trim();

  return term.length > 0 ? term : undefined;
};

export const defaultSearchSort = (search?: string): SearchSort =>
  search ? TERM_SEARCH_SORT : BROWSE_SEARCH_SORT;

/** A chosen sort if it is one, and {@link defaultSearchSort} if it is not. */
export const normalizeSearchSort = (
  value: unknown,
  search?: string,
): SearchSort => (isSearchSort(value) ? value : defaultSearchSort(search));

export const parseSearchTypes = (value: unknown): string[] => {
  const raw =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value
        : [];
  const types = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "string") continue;

    const type = entry.trim();
    if (type.length > 0) types.add(type);
  }

  return [...types];
};

export const serializeSearchTypes = (value: unknown): string | undefined => {
  const types = parseSearchTypes(value).sort((a, b) => a.localeCompare(b));

  return types.length > 0 ? types.join(",") : undefined;
};

export const SEARCH_DATE_PRESETS = ["day", "week", "month", "year"] as const;

export type SearchDatePreset = (typeof SEARCH_DATE_PRESETS)[number];

export type SearchDateRange = "all" | "custom" | SearchDatePreset;

export interface SearchDayRange {
  from: Date;
  to: Date;
}

export const searchDatePresetStart = (
  preset: SearchDatePreset,
  now: Date,
): Date => {
  const start = new Date(now);

  if (preset === "day") start.setHours(start.getHours() - 24);
  if (preset === "week") start.setDate(start.getDate() - 7);
  if (preset === "month") start.setMonth(start.getMonth() - 1);
  if (preset === "year") start.setFullYear(start.getFullYear() - 1);

  return start;
};

export const searchDayRangeBounds = ({
  from,
  to,
}: SearchDayRange): { from: string; to: string } => {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return { from: start.toISOString(), to: end.toISOString() };
};

export const serializeSearchAuthorIds = (
  ids: readonly number[],
): string | undefined => {
  const unique = [...new Set(ids)]
    .filter(id => Number.isSafeInteger(id) && id > 0)
    .sort((a, b) => a - b);

  return unique.length > 0 ? unique.join(",") : undefined;
};

export const searchFeedParamsFor = ({
  authorIds,
  from,
  search,
  sort,
  to,
  types,
}: {
  authorIds?: readonly number[];
  from?: string;
  search?: unknown;
  sort?: unknown;
  to?: string;
  types?: unknown;
} = {}): SearchFeedParams => {
  const term = normalizeSearchTerm(search);
  const params: SearchFeedParams = {
    sort: normalizeSearchSort(sort, term),
  };

  if (term !== undefined) params.search = term;

  const filter = serializeSearchTypes(types);
  if (filter !== undefined) params.types = filter;

  const authors = authorIds ? serializeSearchAuthorIds(authorIds) : undefined;
  if (authors !== undefined) params.authorIds = authors;
  if (from) params.from = from;
  if (to) params.to = to;

  return params;
};

export const appliedSearchTerm = (value: string): null | string => {
  if (value.length >= MIN_SEARCH_TERM_LENGTH) return value;
  if (value.length === 0) return "";

  return null;
};

export const sortForAppliedTerm = (sort: SearchSort): SearchSort =>
  sort === BROWSE_SEARCH_SORT ? TERM_SEARCH_SORT : sort;
