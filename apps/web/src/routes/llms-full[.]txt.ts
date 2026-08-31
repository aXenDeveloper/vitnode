import { createFileRoute } from '@tanstack/react-router'

import { memoizePerSource } from '#/docs/freshness'

/**
 * `/llms-full.txt` - the whole documentation as one Markdown file, for an
 * assistant to read.
 *
 * Migrated from the Next.js route of the same URL, and the URL is the point:
 * it is a well-known path that people and tools have already been given, so it
 * keeps its spelling. `[.]` is TanStack Router's escape for a literal dot in a
 * flat route filename - without it, `llms-full.txt.ts` would be the route
 * `/llms-full/txt`.
 *
 * There is no `/llms.txt`. The Next.js application never had one - only this
 * file - and inventing an index of links during a migration would be new
 * functionality rather than preserved functionality.
 *
 * ## What replaced `"use cache"`
 *
 * The Next.js version wrapped the work in `"use cache"` with `cacheLife("max")`,
 * which is that framework's spelling of "this is build output, compute it once".
 * The equivalent here is `memoizePerSource`: in production the answer is
 * identical for every request and cannot change while the process is running, so
 * the first request computes it and every later one awaits the same promise -
 * and while somebody is *writing* documentation, the cache is keyed on the
 * source module, so an edit produces a new answer without a restart. See
 * `#/docs/freshness`.
 *
 * It is deliberately *not* an HTTP cache directive - `src/lib/document-headers.ts`
 * explains why this application does not hand those out yet, and this response
 * is plain text rather than a document only because of what it contains.
 *
 * `text/plain; charset=utf-8` is stated. The Next.js route returned a bare
 * `Response`, which browsers sniffed as `text/plain` anyway; saying so means a
 * client does not have to guess, and the charset matters for documentation that
 * contains arrows and dashes.
 */
const docsAsMarkdown = memoizePerSource(
  async () => await import('#/docs/source.server'),
  async ({ getLLMText, source }) =>
    (await Promise.all(source.getPages().map(getLLMText))).join('\n\n'),
)

export const Route = createFileRoute('/llms-full.txt')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () =>
          new Response(await docsAsMarkdown(), {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          }),
      }),
  },
})
