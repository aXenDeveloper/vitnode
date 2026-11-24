import '@tanstack/react-start/server-only'

import type { SeoSitemapListSource } from '@vitnode/core/tanstack/seo/server'

/**
 * Every docs page at its canonical URL, for `/sitemap-docs-{n}.xml`. Docs are
 * English-only: a `/pl/docs/...` URL canonicalizes to the English page, so it
 * is not listed. Loaded on the first sitemap request, not at startup.
 */
export const docsSitemapSource: SeoSitemapListSource = {
  id: 'docs',
  urls: async () => {
    const { source } = await import('./source.server')

    return source.getPages().map((page) => ({ path: page.url }))
  },
}
