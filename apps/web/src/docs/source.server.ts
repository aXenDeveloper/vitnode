import '@tanstack/react-start/server-only'

import type { InferPageType } from 'fumadocs-core/source'

import { docs } from 'collections/server'
import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import { icons } from 'lucide-react'
import { createElement } from 'react'

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

export const getLLMText = async (page: DocsPage): Promise<string> => {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title}\n\n${processed}`
}
