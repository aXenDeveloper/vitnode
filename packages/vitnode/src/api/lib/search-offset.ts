/**
 * The furthest into a relevance-ranked result set a caller may page.
 *
 * Relevance ordering has no stable key to seek on, so its cursor is an offset -
 * and an offset is the one pagination shape whose cost grows with the page
 * number. Nobody reaches page ten thousand of a search by reading; they reach it
 * by editing the URL. It is also Elasticsearch's default `max_result_window`.
 */
export const MAX_SEARCH_OFFSET = 10_000;

/**
 * Reads a search cursor as an offset: a non-negative safe integer, clamped to
 * `max`. Anything else - `"abc"`, `"-1"`, `"1e400"` - is `undefined`, which a
 * caller treats as the first page. `Number("abc")` is `NaN`, and a search engine
 * answers `NaN` (or an offset past its window) with a 500 rather than a 400.
 */
export const parseSearchOffset = (
  cursor: string | undefined,
  max: number = MAX_SEARCH_OFFSET,
): number | undefined => {
  if (!cursor) return undefined;

  const parsed = Number(cursor);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;

  return Math.min(parsed, Math.max(0, max));
};
