import type { SearchAPI } from 'fumadocs-core/search/server'

import { createFileRoute } from '@tanstack/react-router'

import { memoizePerSource } from '#/docs/freshness'

const docsSearchApi = memoizePerSource(
  async () => await import('#/docs/source.server'),
  async ({ source }): Promise<SearchAPI> => {
    const { createFromSource } = await import('fumadocs-core/search/server')

    return createFromSource(source)
  },
)

export const Route = createFileRoute('/docs/search')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => await (await docsSearchApi()).GET(request),
      }),
  },
})
