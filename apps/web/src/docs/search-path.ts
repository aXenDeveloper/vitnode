/**
 * Where the documentation's search index answers, and why it is not
 * `/api/search`.
 *
 * `/api/*` belongs to Hono. It is the whole of this application's API and its
 * security boundary, mounted by `src/routes/api/$.ts` and shared verbatim with
 * `apps/api`, and Fumadocs claiming a path inside it would be a second,
 * unrelated server answering from the same namespace - the exact ambiguity the
 * migration has spent fifteen stages avoiding. Routing the search *through* Hono
 * instead would be worse in a different way: the index is built from the MDX
 * collection, so the API process would have to import the whole documentation
 * build graph to answer a query about it.
 *
 * So the search index is a documentation resource and lives with the
 * documentation: `/docs/search`, served by `src/routes/docs.search.ts`, which is
 * a server route and renders no document.
 *
 * ## It is a root-relative path on purpose
 *
 * The reader may be at `/pl/docs/dev`, and this is passed to `fetch` - which
 * resolves a leading slash against the origin, not the current path. So the
 * request is `/docs/search` from every page in every language, which is the one
 * spelling the server route is mounted at. The results carry internal URLs
 * (`/docs/dev/...`); the locale prefix is put back by the router when the reader
 * navigates to one, exactly as it is for every other link in this application.
 *
 * ## The one thing this shadows
 *
 * A static segment outranks a splat, so this path is not reachable as a
 * document: a `content/docs/search.mdx` would be indexed and never render.
 * There is no such file, and `src/tests/docs-route.test.ts` fails if one is ever
 * added - which turns a silently unreachable page into a failing build.
 */
export const DOCS_SEARCH_PATH = '/docs/search'
