import type { SearchFeedParams } from "./search-feed-query";

/**
 * What a search *request* is, decided once, as pure functions.
 *
 * The search page has three inputs - a term, a set of content types, a sort -
 * and three places that have to agree on what they mean: a Next.js Server
 * Component reading `searchParams`, a TanStack Start route reading its own
 * search schema, and the controls the visitor drives in the browser. Every one
 * of them used to answer separately, in a line or two of inline logic, and the
 * answers were only accidentally the same: `search-view.tsx` decided the default
 * sort with `search ? "relevance" : "newest"` while `search-controls.tsx`
 * decided it with `defaultParams.sort ?? "newest"`.
 *
 * So the decisions live here, and nowhere else. Nothing in this module renders,
 * fetches or knows which framework is asking - which is also what makes it the
 * part of the search slice that is worth testing directly.
 *
 * {@link SearchFeedParams} - what these produce - is the shared feed's own
 * parameter type, and `searchFeedRequest` in `./search-feed-query` is the only
 * thing that turns one into a URL.
 */

/**
 * The shortest term the controls will search on.
 *
 * Two characters is almost always a prefix of something the visitor is still
 * typing, and searching on it costs a full-text query per keystroke for a page
 * of results nobody reads.
 */
export const MIN_SEARCH_TERM_LENGTH = 3;

/**
 * The longest term that reaches the API.
 *
 * A term arrives from a URL, so its length is whatever somebody put there. The
 * API takes `search` as an unbounded string and hands it to the full-text
 * engine, so this is the one place a 40KB query string stops being one.
 */
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

/**
 * A term worth searching for, or nothing at all.
 *
 * The input is deliberately `unknown`: `?search=a&search=b` parses to an array,
 * a bare `?search` to an empty string, and both reach this from a URL nobody
 * here wrote. Anything that is not a usable string becomes `undefined`, which is
 * the browse feed - a malformed parameter should render the page, not break the
 * route.
 *
 * Trimmed twice on purpose. The first trim is the term itself; the cut at
 * {@link MAX_SEARCH_TERM_LENGTH} can land mid-space, so the second tidies the
 * tail rather than sending a term ending in a run of blanks.
 */
export const normalizeSearchTerm = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const term = value.trim().slice(0, MAX_SEARCH_TERM_LENGTH).trim();

  return term.length > 0 ? term : undefined;
};

/**
 * The sort a feed takes when nobody has chosen one.
 *
 * Relevance is meaningless without a term - every row scores the same - so a
 * browse feed is newest-first and a search is relevance-first. This is the rule
 * `search-view.tsx` has always applied; it is stated here so the controls and a
 * route loader apply the same one.
 */
export const defaultSearchSort = (search?: string): SearchSort =>
  search ? TERM_SEARCH_SORT : BROWSE_SEARCH_SORT;

/** A chosen sort if it is one, and {@link defaultSearchSort} if it is not. */
export const normalizeSearchSort = (
  value: unknown,
  search?: string,
): SearchSort => (isSearchSort(value) ? value : defaultSearchSort(search));

/**
 * The content types a feed is filtered to, as a list.
 *
 * Accepts either shape the filter is held in - the API's comma-separated string
 * or the array the controls keep in state - because both ends of the round trip
 * come through here. Blank entries and duplicates are dropped rather than sent:
 * `types=,blog_post,` reaches the API as three filters, two of which match
 * nothing, and `blog_post,blog_post` is a filter applied twice.
 *
 * Unknown types are *not* dropped. A type is only unknown to the renderer
 * registry - a plugin can index one this build has no icon for - and refusing it
 * here would silently ignore a filter the API would have honoured.
 */
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

/**
 * {@link parseSearchTypes}, back in the shape the API's query takes.
 *
 * Sorted, and that is the load-bearing part. This string ends up in the query
 * key, so `blog_post,topic` and `topic,blog_post` would otherwise be two cache
 * entries holding the same results - the API applies the filter as a set and
 * does not care what order it arrived in, but Query hashes the string. Two
 * visitors who ticked the same two boxes in a different order are looking at one
 * feed.
 *
 * The *display* order is unaffected: the controls hold their filter as an array
 * and only ever ask it whether a type is in it.
 */
export const serializeSearchTypes = (value: unknown): string | undefined => {
  const types = parseSearchTypes(value).sort((a, b) => a.localeCompare(b));

  return types.length > 0 ? types.join(",") : undefined;
};

/**
 * A term, a sort and a set of types, as the shared feed's parameters.
 *
 * The one function that builds a {@link SearchFeedParams}, and therefore the one
 * thing that decides which cache entry a search lands in: the object is part of
 * the query key. Every key it omits is omitted *entirely* rather than set to
 * `undefined`, so a route loader calling this with `{ search }` and a component
 * calling it with `{ search, sort, types }` produce the same object - and Query,
 * which hashes keys structurally, reads them as one entry.
 *
 * With no term at all this returns `{ sort: "newest" }`, which is exactly the
 * browse feed `/discover` asks for. That is not a coincidence to be designed
 * away: they are the same request over the same documents, so they share a cache
 * entry.
 */
export const searchFeedParamsFor = ({
  search,
  sort,
  types,
}: {
  search?: unknown;
  sort?: unknown;
  types?: unknown;
} = {}): SearchFeedParams => {
  const term = normalizeSearchTerm(search);
  const params: SearchFeedParams = {
    sort: normalizeSearchSort(sort, term),
  };

  if (term !== undefined) params.search = term;

  const filter = serializeSearchTypes(types);
  if (filter !== undefined) params.types = filter;

  return params;
};

/**
 * The term the feed should search on after a keystroke - or `null` for "not
 * yet", which is the answer that matters.
 *
 * Three cases, and the middle one is the reason this is a function rather than a
 * comparison at the call site:
 *
 *     "wid"  ->  "wid"   long enough to search
 *     ""     ->  ""      cleared, so go back to browsing
 *     "wi"   ->  null    keep showing what is on screen
 *
 * A one- or two-character term leaves the feed alone rather than resetting it to
 * the browse feed, so backspacing through a word does not flash a page of
 * unrelated results on the way.
 *
 * Length is measured on the raw value, not on a trimmed one: that is the
 * behaviour the control has always had, and a term of blanks is normalised away
 * later by {@link normalizeSearchTerm} anyway.
 */
export const appliedSearchTerm = (value: string): null | string => {
  if (value.length >= MIN_SEARCH_TERM_LENGTH) return value;
  if (value.length === 0) return "";

  return null;
};

/**
 * The sort to use once a term has been typed.
 *
 * Only the browse default moves. A visitor who explicitly picked "oldest" keeps
 * it - overriding a deliberate choice because they then typed something is the
 * kind of helpfulness that reads as a bug.
 */
export const sortForAppliedTerm = (sort: SearchSort): SearchSort =>
  sort === BROWSE_SEARCH_SORT ? TERM_SEARCH_SORT : sort;
