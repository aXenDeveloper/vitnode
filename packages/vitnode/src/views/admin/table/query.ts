export const ADMIN_QUERY_ROOT = ["vitnode", "admin"] as const;

/** The root every cache entry for one admin screen hangs off. */
export const adminQueryRoot = (screen: string) =>
  [...ADMIN_QUERY_ROOT, screen] as const;
