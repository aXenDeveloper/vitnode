import { MAX_SEARCH_SUGGESTIONS } from "@/api/lib/search-suggestions";

/**
 * A query parameter as a positive integer, or nothing.
 *
 * `Number("abc")` is `NaN` and `new Date("abc")` is an Invalid Date, and both
 * used to travel straight into the query builder - where Postgres rejects them,
 * which reaches the caller as a `500` and writes a `core_logs` row on the way.
 * This is a public, unauthenticated endpoint, so that was a log-flooding
 * primitive as much as it was a bad status code. A filter nobody can parse is
 * not an error; it is a filter that was not asked for.
 */
export const positiveIntOrUndefined = (
  value: string | undefined,
): number | undefined => {
  if (value === undefined || value === "") return undefined;

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const MAX_SEARCH_AUTHOR_IDS = 20;

export const positiveIntListOrUndefined = (
  value: string | undefined,
): number[] | undefined => {
  if (!value) return undefined;

  const ids = [
    ...new Set(
      value
        .split(",")
        .map(entry => positiveIntOrUndefined(entry.trim()))
        .filter(id => id !== undefined),
    ),
  ].slice(0, MAX_SEARCH_AUTHOR_IDS);

  return ids.length > 0 ? ids : undefined;
};

/** A query parameter as a real date, or nothing. See above. */
export const dateOrUndefined = (
  value: string | undefined,
): Date | undefined => {
  if (value === undefined || value === "") return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const DEFAULT_SEARCH_SUGGESTIONS = 6;

export const searchSuggestionsLimit = (first: string | undefined): number =>
  Math.min(
    positiveIntOrUndefined(first) ?? DEFAULT_SEARCH_SUGGESTIONS,
    MAX_SEARCH_SUGGESTIONS,
  );
