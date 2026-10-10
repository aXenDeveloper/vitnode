const MOVED_SECTIONS: readonly (readonly [string, string])[] = [
  ['dev/content-engine', 'content-engine'],
]

const RENAMED_PAGES: Readonly<Record<string, string>> = {
  'content-engine/content-delivery-and-seo': 'content-engine/public-pages',
  'content-engine/database-and-migrations': 'content-engine/database',
  'content-engine/defining-a-content-type':
    'content-engine/create-a-content-type',
  'content-engine/plugin-registration': 'content-engine/plugin-files',
  'content-engine/production-and-security': 'content-engine/production',
  'content-engine/public-api-and-caching': 'content-engine/public-api',
  'content-engine/publication-and-editorial': 'content-engine/editorial',
  'content-engine/relations-and-advanced-modeling': 'content-engine/relations',
  'content-engine/services-and-api': 'content-engine/services',
}

export const movedDocsPath = (splat: string): string | undefined => {
  const path = splat.replace(/^\/+|\/+$/g, '')
  const section = MOVED_SECTIONS.find(
    ([from]) => path === from || path.startsWith(`${from}/`),
  )
  const moved = section ? `${section[1]}${path.slice(section[0].length)}` : path
  const renamed = RENAMED_PAGES[moved] ?? moved

  return renamed === path ? undefined : renamed
}
