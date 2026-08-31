import { useDocsSearch } from 'fumadocs-core/search/client'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search'

import { DOCS_SEARCH_PATH } from './search-path'

/**
 * The documentation's own search, opened with `⌘K` from anywhere under `/docs`.
 *
 * Fumadocs' own dialog and Fumadocs' own client - `type: "fetch"` queries the
 * index over HTTP and gets back titles, headings and the text under them, which
 * is what makes searching for a sentence in the middle of a page work.
 *
 * The only thing this application changes is `api`. It defaults to
 * `/api/search`, and `/api/*` is Hono's; see `./search-path`.
 *
 * It is deliberately *not* the site-wide search at `/search`. That one indexes
 * VitNode content through the API - posts, articles, whatever a plugin
 * registered - and knows nothing about MDX; this one indexes documentation and
 * knows nothing about content. Two indexes, two dialogs, and the docs shell is
 * the only place this one is mounted.
 */
const DocsSearchDialog = (props: SharedProps) => {
  const { query, search, setSearch } = useDocsSearch({
    api: DOCS_SEARCH_PATH,
    type: 'fetch',
  })

  return (
    <SearchDialog
      isLoading={query.isLoading}
      onSearchChange={setSearch}
      search={search}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  )
}

export default DocsSearchDialog
