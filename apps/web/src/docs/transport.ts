import type { SerializedPageTree } from 'fumadocs-core/source/client'

import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { docsGithubUrl } from './github'

/**
 * The whole server/browser seam of the documentation, and it is two functions
 * wide.
 *
 * Fumadocs' source loader is a build-time index of every document: it holds the
 * frontmatter and `meta.json` of ~120 files plus the Lucide icon set the sidebar
 * draws from. A browser must never receive it, and equally a browser is what
 * renders the MDX - so something has to cross, and *what* crosses is the whole
 * design decision.
 *
 *     server                              browser
 *     source.getPage(slug)      ->  { path, title, description }
 *     source.serializePageTree  ->  the sidebar tree, as JSON
 *                                    |
 *                              collections/browser -> the compiled MDX chunk
 *
 * Data only. No compiled component and no React element is ever put into a
 * server-function payload - the page's *identity* is, and the browser's own
 * generated collection (`src/docs/client-loader.tsx`) turns that identity into
 * the module it imports. That is Fumadocs' supported TanStack Start strategy
 * rather than something assembled here: `createClientLoader` exists precisely so
 * the body is a code-split `import()` in the client graph instead of a payload.
 *
 * ## Why these are `createServerFn` when almost nothing else in this app is
 *
 * `content/docs/dev/tanstack/server-functions.mdx` says it out loud, and it is
 * worth restating where the exception actually lives: ordinary VitNode reads go
 * to Hono, which is this application's real API and security boundary.
 * Documentation is neither - it is build output that exists only inside this
 * Vite build, and asking Hono to serve it would mean pulling the MDX compiler,
 * Shiki and the whole content index into the API process. So the docs get a
 * server function, and nothing else does.
 *
 * They are declared here, in the host, for the reason every `createServerFn` in
 * this repository is: the Start compiler has to transform the declaring module
 * in *both* bundles, and `@vitnode/core` is externalised from this app's SSR
 * pass. See `src/lib/auth.ts`.
 *
 * ## The source loader is reached by `await import()`, not by a static import
 *
 * Start strips a handler's body - and everything it names statically - out of
 * the client build, so a top-level `import { source } from "./source.server"`
 * would also be correct. The dynamic import is about the *server* build: this
 * module is imported by two eager route files, and on the server nothing strips
 * anything. A static import would make every request to this application - the
 * front page included - evaluate the whole content index at module load. Behind
 * `await import()` it is evaluated the first time a docs page is asked for, and
 * cached by the module registry from then on.
 */

/**
 * A splat, as a slug array.
 *
 * A server function's input is whatever a caller posts, not whatever the router
 * matched, so this is parsed rather than trusted. Empty segments are dropped so
 * that `/docs/dev/` and `/docs//dev` resolve like `/docs/dev` instead of missing:
 * `source.getPage` matches an exact slug array, and an empty member matches
 * nothing.
 */
const docsSlugSchema = z
  .string()
  .max(512)
  .transform((splat) => splat.split('/').filter(Boolean))

/**
 * A document's identity and its metadata, resolved on the server.
 *
 * One lookup serving three consumers, which is the point of returning it from
 * the loader rather than resolving it a second time in `head`: the `<title>`,
 * the `<h1>` and the MDX body all come from this object, so they cannot
 * disagree.
 *
 * The table of contents is deliberately **not** here. A heading's title is a
 * `ReactNode`, so a heading containing inline code is a React element and
 * TanStack Start's serializer rejects it - at compile time, and rightly. It
 * arrives with the body instead, out of the compiled MDX module's own `toc`
 * export; see `./article`.
 *
 * `title` is the page's own - the `<h1>` - and `metaTitle` is that plus its
 * ancestors, which is what the browser tab shows. The Next.js application
 * composed the same string in `generateMetadata` from `getBreadcrumbItems`, and
 * it is preserved: "Create a plugin - Plugins - Development". Only the ancestors
 * are joined, deepest first; the page's own crumb is dropped because it is
 * already the head of the string.
 *
 * `notFound()` rather than a `null` result. It is the router's own signal, it
 * survives the server-function boundary, and it is what makes
 * `/docs/does-not-exist` a 404 rendered inside the docs shell rather than a
 * redirect to `/docs`.
 */
export const getDocsPage = createServerFn()
  .validator(docsSlugSchema)
  .handler(async ({ data: slugs }) => {
    const [{ getBreadcrumbItems }, { source }] = await Promise.all([
      import('fumadocs-core/breadcrumb'),
      import('./source.server'),
    ])
    const page = source.getPage(slugs)

    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!page) throw notFound()

    const ancestors = getBreadcrumbItems(page.url, source.pageTree, {})
      .slice(0, -1)
      .reverse()
      // `name` is a `ReactNode`, so a crumb whose label carries markup is an
      // element rather than a string. Only the plain ones can go in a `<title>`.
      .flatMap((item) => (typeof item.name === 'string' ? [item.name] : []))

    return {
      description: page.data.description,
      full: page.data.full ?? false,
      githubUrl: docsGithubUrl(page.path),
      metaTitle: [page.data.title, ...ancestors].join(' - '),
      path: page.path,
      title: page.data.title,
      url: page.url,
    }
  })

/** Everything a docs page route knows about its document before it renders. */
export type DocsPageData = Awaited<ReturnType<typeof getDocsPage>>

/**
 * The sidebar's tree, as JSON.
 *
 * `serializePageTree` is Fumadocs' own answer to "this loader is optimised for
 * React Server Components and I am not rendering in one": it renders each node's
 * icon and name to an HTML string, and `useFumadocsLoader` on the other side
 * turns them back into elements. Nothing here hand-rolls a serializer.
 *
 * It is one object for the whole documentation rather than one per page, which
 * is why the shell route fetches it and the page routes do not - see
 * `src/routes/_docs.tsx`.
 */
export const getDocsPageTree = createServerFn().handler(
  async (): Promise<SerializedPageTree> => {
    const { source } = await import('./source.server')

    return await source.serializePageTree(source.pageTree)
  },
)
