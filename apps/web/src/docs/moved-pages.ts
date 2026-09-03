/**
 * Where a document used to live, and where it lives now.
 *
 * The documentation was reorganised: `docs/tanstack/*` folded into `docs/dev/*`,
 * `docs/dev/tanstack/*` was dissolved into the categories its pages actually
 * belong to - routing with routing, metadata with metadata, the plugin tutorial
 * with the plugin section - and the two AdminCP pages moved under
 * `docs/dev/plugins/admin`. Those old URLs shipped, which means they are in
 * somebody's bookmarks and in a search index, so `/docs/$` answers them with a
 * `301` to the new slug rather than a 404.
 *
 * A `301` and not a `302`: the move is permanent, and a permanent redirect is
 * what transfers the old URL's ranking to the new one.
 *
 * Slugs here are what `/docs/$` receives as its splat - the path after `/docs/`,
 * with no leading or trailing slash and no locale prefix, because the router has
 * already stripped that.
 */
const EXACT_MOVES: Record<string, string> = {
  'dev/not-found': 'dev/routing/not-found',
  'dev/plugins/admin-page': 'dev/plugins/admin',
  'dev/plugins/dashboard-widgets': 'dev/plugins/admin/dashboard-widgets',
  'dev/plugins/route-manifest': 'dev/plugins/routes',
  'dev/tanstack': 'dev/architecture',
  'dev/tanstack/admin': 'dev/plugins/admin-page',
  'dev/tanstack/data-loading': 'dev/data-loading',
  'dev/tanstack/i18n': 'dev/i18n/pages',
  'dev/tanstack/initial-bundle': 'dev/performance',
  'dev/tanstack/metadata': 'dev/routing/metadata',
  'dev/tanstack/navigation': 'dev/routing/navigation',
  'dev/tanstack/plugin': 'dev/plugins/create',
  'dev/tanstack/routing': 'dev/routing',
  'dev/tanstack/server-functions': 'dev/server-functions',
  tanstack: 'dev',
}

/**
 * The `docs/tanstack/*` tree kept its shape when it moved under `docs/dev`, so
 * one prefix rule covers all fourteen of its pages instead of fourteen entries.
 * `docs/tanstack/database/pagination` becomes `docs/dev/database/pagination`.
 */
const PREFIX_MOVES: [from: string, to: string][] = [['tanstack/', 'dev/']]

export const movedDocsSlug = (slug: string): string | undefined => {
  const normalized = slug.replace(/^\/+|\/+$/g, '')
  const exact = EXACT_MOVES[normalized]

  if (exact) return exact

  for (const [from, to] of PREFIX_MOVES) {
    if (normalized.startsWith(from)) {
      return to + normalized.slice(from.length)
    }
  }

  return undefined
}
