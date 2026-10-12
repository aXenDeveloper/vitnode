/**
 * Names the data a response was built from, so a page rendered from it can be
 * invalidated when that data changes.
 *
 * An API route sets it (see `setPageCacheTags`); the server-side fetcher reads
 * it while a cached page renders, and the page is stored with every tag its
 * render read. Content Engine routes tag their responses on their own.
 */
export const PAGE_CACHE_TAGS_HEADER = "x-vitnode-cache-tags";

/**
 * Marks a request as a shared render: one whose HTML is stored and served to
 * every visitor, so it must not read the visitor's session. Set only by the
 * page cache on the request it renders, and stripped from incoming requests.
 */
export const PAGE_CACHE_RENDER_HEADER = "x-vitnode-shared-render";

/** `HIT`, `STALE`, `MISS`, `REVALIDATED` or `BYPASS` - for checking it works. */
export const PAGE_CACHE_STATUS_HEADER = "x-vitnode-cache";

/** A tag is any string; commas and whitespace are escaped on the wire. */
export const encodePageCacheTags = (tags: Iterable<string>): string =>
  [...new Set(tags)]
    .filter(tag => tag.length > 0)
    .map(tag => encodeURIComponent(tag))
    .join(",");

export const decodePageCacheTags = (
  value: null | string | undefined,
): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .flatMap(part => {
      try {
        return [decodeURIComponent(part)];
      } catch {
        return [];
      }
    });
};
