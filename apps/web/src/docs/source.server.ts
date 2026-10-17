import '@tanstack/react-start/server-only'

import type { InferPageType } from 'fumadocs-core/source'

import { loader } from 'fumadocs-core/source'

import { DOCS_ROUTE } from './shared'
import { docs } from './source'

export const source = loader({
  baseUrl: DOCS_ROUTE,
  source: docs.toFumadocsSource(),
})

export type DocsPage = InferPageType<typeof source>

export const getLLMText = async (page: DocsPage): Promise<string> => {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title} (${page.url})\n\n${processed}`
}
