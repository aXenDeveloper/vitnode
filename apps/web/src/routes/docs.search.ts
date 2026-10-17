import { createFileRoute } from '@tanstack/react-router'
import { componentNameToIconName } from '@vitnode/core/lib/emoji-icon'
import { createFromSource } from 'fumadocs-core/search/server'

import { DOCS_TEXT_CACHE_HEADERS, source } from '@/docs/source.server'

// Built once per server: the index is the expensive part and only changes
// with a build. Each query's results are computed per request, and the URL
// carries the query, so a CDN keys its copy by it.
const docsSearch = createFromSource(source, { language: 'english' })

const pageIconOf = (url: string): string | undefined => {
  const icon = source.getPageByHref(url)?.page.data.icon

  return icon ? componentNameToIconName(icon) : undefined
}

export const Route = createFileRoute('/docs/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams.get('query') ?? ''
        const results = await docsSearch.search(query)

        return Response.json(
          results.map((result) =>
            result.type === 'page'
              ? { ...result, icon: pageIconOf(result.url) }
              : result,
          ),
          { headers: DOCS_TEXT_CACHE_HEADERS },
        )
      },
    },
  },
})
