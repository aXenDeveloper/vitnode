import type { SearchAPI } from 'fumadocs-core/search/server'

import { createFileRoute } from '@tanstack/react-router'

/**
 * `/docs/search` - the documentation's search index, and the one endpoint in
 * this application that is not Hono's.
 *
 * `src/docs/search-path.ts` carries the argument for the URL: `/api/*` is the
 * VitNode API and its security boundary, Fumadocs must not claim a path inside
 * it, and routing an MDX index through Hono would mean the API process importing
 * the documentation build graph. So the index is a documentation resource served
 * from the documentation's own namespace.
 *
 * `server` is the only option on this route, exactly as on `/api/$`, and for the
 * same reason: TanStack Start prunes a route file whose sole option is `server`
 * out of the client route tree, so `createFromSource` and the content index it
 * builds cannot reach a browser bundle.
 *
 * `GET` alone. A search query is a read, it carries no body, and there is
 * nothing here for another method to do - unlike the API mount, which forwards
 * `ANY` because Hono owns the routing behind it.
 *
 * ## The index is built once, on the first query
 *
 * `createFromSource` reads every page's structured data and builds an Orama
 * index from it. Doing that at module load would make it part of server startup
 * for an application whose front page is not the documentation; behind a lazily
 * awaited promise it happens the first time somebody searches, and the promise
 * itself is the cache from then on. Assigning the promise before awaiting it is
 * what makes two simultaneous first queries build one index rather than two.
 */
let searchApi: Promise<SearchAPI> | undefined

const docsSearchApi = async (): Promise<SearchAPI> => {
  searchApi ??= (async () => {
    const [{ createFromSource }, { source }] = await Promise.all([
      import('fumadocs-core/search/server'),
      import('#/docs/source.server'),
    ])

    return createFromSource(source)
  })()

  return await searchApi
}

export const Route = createFileRoute('/docs/search')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => await (await docsSearchApi()).GET(request),
      }),
  },
})
