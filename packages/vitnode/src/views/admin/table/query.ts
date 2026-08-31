/**
 * Where every AdminCP screen's cache entries live.
 *
 * One prefix for the whole panel, so a sign-out can drop all of it in a single
 * `removeQueries` call rather than needing a list that somebody has to remember
 * to extend. See `removeAdminShellQueries` in `tanstack/admin/queries.ts`, which
 * is what does the dropping.
 *
 * `["vitnode", "admin"]` is deliberately *not* a prefix of
 * `["vitnode", "admin-session"]`: Query matches keys element by element, so
 * `"admin"` and `"admin-session"` are different second segments. The session
 * entry has its own lifecycle (`removeAdminSession`) and must not be collected
 * by a screen's invalidation.
 */
export const ADMIN_QUERY_ROOT = ["vitnode", "admin"] as const;

/** The root every cache entry for one admin screen hangs off. */
export const adminQueryRoot = (screen: string) =>
  [...ADMIN_QUERY_ROOT, screen] as const;
