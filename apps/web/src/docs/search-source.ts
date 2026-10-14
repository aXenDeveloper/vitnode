import type {
  SearchSource,
  SearchSourceItem,
} from '@vitnode/core/tanstack/search'
import type { SortedResult } from 'fumadocs-core/search'

import { BookOpenIcon } from 'lucide-react'

import { docsSectionOf } from './section'
import { DOCS_SEARCH_PATH } from './shared'

const DOCS_SEARCH_LIMIT = 5

type DocsSearchResult = SortedResult & { icon?: string }

const plainText = (markdown: string): string =>
  markdown
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const pageContext = (breadcrumbs: string[] | undefined): null | string => {
  const trail = (breadcrumbs ?? []).slice(1)

  return trail.length > 0 ? trail.join(' / ') : null
}

const sectionColorOf = (url: string): string | undefined => {
  const section = docsSectionOf(url)

  return section ? `var(--${section}-color)` : undefined
}

interface DocsPageHit {
  firstHit?: DocsSearchResult
  page: DocsSearchResult
}

const groupByPage = (results: DocsSearchResult[]): DocsPageHit[] =>
  results.reduce<DocsPageHit[]>((pages, result) => {
    if (result.type === 'page') return [...pages, { page: result }]

    const current = pages.at(-1)
    if (current && !current.firstHit && !result.table) {
      current.firstHit = result
    }

    return pages
  }, [])

const toSearchItem = (
  { firstHit, page }: DocsPageHit,
  titleMatches: boolean,
): SearchSourceItem => ({
  color: sectionColorOf(page.url),
  context: pageContext(page.breadcrumbs),
  excerpt: firstHit ? plainText(firstHit.content) : null,
  icon: page.icon,
  id: page.id,
  title: page.content,
  url: titleMatches ? page.url : (firstHit?.url ?? page.url),
})

export const docsSearchSource: SearchSource = {
  icon: BookOpenIcon,
  id: 'docs',
  labelKey: 'site.search.docs',
  namespace: 'site.search',
  search: async ({ signal, term }) => {
    const response = await fetch(
      `${DOCS_SEARCH_PATH}?${new URLSearchParams({ query: term }).toString()}`,
      { signal },
    )

    if (!response.ok) {
      throw new Error(`The docs search answered ${response.status}.`)
    }

    const results: DocsSearchResult[] = await response.json()
    const lowerTerm = term.toLowerCase()
    const pages = groupByPage(results).map((hit) => ({
      hit,
      titleMatches: hit.page.content.toLowerCase().includes(lowerTerm),
    }))

    return [
      ...pages.filter((page) => page.titleMatches),
      ...pages.filter((page) => !page.titleMatches),
    ]
      .slice(0, DOCS_SEARCH_LIMIT)
      .map(({ hit, titleMatches }) => toSearchItem(hit, titleMatches))
  },
}
