/**
 * The query string of `/example/browse`, validated by the **router**.
 *
 * A module of its own, imported eagerly, and that is the whole reason it is not
 * inside `browse-page.tsx`: a router's `validateSearch` runs during path
 * matching, which is before any chunk is fetched, so a schema that lived in the
 * lazy page module would arrive long after the URL had been matched. The route's
 * manifest entry names this file as its `searchEntry`, and the app's build turns
 * that into a static import.
 *
 * ## The contract on this file
 *
 * It exports `validateSearch` and nothing that renders. No React, no component,
 * no import of the page it belongs to - because everything reachable from here
 * is in the initial bundle, which is the price of being early. Keep it to the
 * schema.
 *
 * It is also **total**. TanStack calls it during matching, on whatever somebody
 * typed or pasted, and a throw there is a router error screen rather than a
 * page. So `?page=banana` becomes page 1 and `?page=999` is clamped - neither is
 * rejected.
 *
 * ## Why a number rather than a string
 *
 * The router's default search serialisation JSON-encodes what it does not
 * recognise, so a `page` kept as `"2"` comes back as `?page=%222%22`. Parsing to
 * a number here is what keeps the URL `?page=2`, and it is why the clamp below
 * can be arithmetic rather than string handling.
 */

/** How many items the page shows, and what `page` is an index into. */
export const BROWSE_PAGE_SIZE = 3;

/** The last page there is anything to show on. */
export const BROWSE_LAST_PAGE = 3;

export interface BrowseSearch {
  page: number;
}

export const validateSearch = (
  input: Record<string, unknown>,
): BrowseSearch => {
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
