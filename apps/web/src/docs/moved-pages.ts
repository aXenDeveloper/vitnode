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
