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

// The docs only change with a build, so a production server renders each
// text once and lets CDNs keep it. Dev stays fresh so edits show up at once.
const IS_MEMOIZED = !import.meta.env.DEV

export const DOCS_TEXT_CACHE_HEADERS: Record<string, string> = IS_MEMOIZED
  ? { 'cache-control': 'public, max-age=300, s-maxage=3600' }
  : {}

export const memoizeDocsText = <T>(
  build: () => Promise<T>,
): (() => Promise<T>) => {
  let pending: Promise<T> | undefined

  return async () => {
    if (!IS_MEMOIZED) return await build()

    pending ??= build().catch((error: unknown) => {
      pending = undefined
      throw error
    })

    return await pending
  }
}

const renderLLMText = async (page: DocsPage): Promise<string> => {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title} (${page.url})\n\n${processed}`
}

// Bounded by the number of pages in the build.
const llmTexts = new Map<string, () => Promise<string>>()

export const getLLMText = async (page: DocsPage): Promise<string> => {
  let read = llmTexts.get(page.url)

  if (!read) {
    read = memoizeDocsText(async () => await renderLLMText(page))
    llmTexts.set(page.url, read)
  }

  return await read()
}
