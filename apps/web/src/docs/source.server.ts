import '@tanstack/react-start/server-only'

import type { InferPageType } from 'fumadocs-core/source'

import { docs } from 'collections/server'
import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import { icons } from 'lucide-react'
import { createElement } from 'react'

/**
 * The documentation, as Fumadocs sees it: every page, its frontmatter, and the
 * tree the sidebar is drawn from.
 *
 * **Server only, and the import at the top of this file is what enforces it.**
 * `collections/server` is `.source/server.ts` - a generated module that eagerly
 * loads the frontmatter and `meta.json` of all ~120 documents, and reaches the
 * Lucide icon set below to turn a `meta.json` icon name into an element. None of
 * that belongs in a browser bundle, and the failure mode without the guard is
 * not an error: it is a docs page that quietly ships the whole content index to
 * every reader.
 *
 * Everything the browser needs out of this crosses the boundary as data -
 * `src/docs/transport.ts` is the whole of that seam, and it is three server
 * functions wide.
 *
 * `baseUrl: "/docs"` is the same value the Next.js application used, and it is
 * the *internal* path in the TanStack sense: `/docs/dev/plugins/create`. The
 * locale prefix is not part of it and must never be - one route tree, two public
 * URL shapes, and the router's rewrite owns the difference. See
 * `src/tests/docs-route.test.ts`.
 */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (icon && icon in icons) {
      return createElement(icons[icon as keyof typeof icons])
    }
  },
  plugins: [lucideIconsPlugin()],
})

/** One page of the collection, for helpers that take a resolved page. */
export type DocsPage = InferPageType<typeof source>

/**
 * One page as plain Markdown, for `/llms-full.txt`.
 *
 * `getText("processed")` is what `includeProcessedMarkdown` in
 * `source.config.ts` exists for: the rendered Markdown is kept beside the
 * compiled component, so this needs neither a second compile nor React.
 */
export const getLLMText = async (page: DocsPage): Promise<string> => {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title}\n\n${processed}`
}
