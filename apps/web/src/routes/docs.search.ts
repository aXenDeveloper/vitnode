import type { SearchAPI } from 'fumadocs-core/search/server'

import { createFileRoute } from '@tanstack/react-router'

import { memoizePerSource } from '#/docs/freshness'

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
 * for an application whose front page is not the documentation; behind
 * `memoizePerSource` it happens the first time somebody searches, and is
 * reused from then on.
 *
 * "From then on" means *until the documentation changes*, which is the whole
 * reason that helper exists rather than a `let`. A module-level promise is
 * correct in production, where `content/docs` is frozen build output, and wrong
 * while somebody is writing: it would keep answering searches from the index
 * built at boot until the dev server was restarted. Keying the cache on the
 * source module gives both behaviours from one mechanism - see
 * `#/docs/freshness`.
 */
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
