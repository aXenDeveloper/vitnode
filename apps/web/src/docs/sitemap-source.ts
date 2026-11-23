import { defineSitemapSource } from '@vitnode/api/lib/seo/sitemap'

const docsUrls = async (): Promise<string[]> => {
  const { source } = await import('./source.server')

  return source
    .getPages()
    .map((page) => page.url)
    .sort((a, b) => a.localeCompare(b))
}

/** Every documentation page, in its own sitemap files. */
export const docsSitemapSource = defineSitemapSource({
  id: 'docs',
  label: 'Documentation',
  count: async () => (await docsUrls()).length,
  getEntries: async (_c, { limit, offset }) =>
    (await docsUrls())
      .slice(offset, offset + limit)
      .map((loc) => ({ changeFrequency: 'weekly', loc, priority: 0.6 })),
})
