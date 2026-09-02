import { createFileRoute, redirect } from '@tanstack/react-router'

import { movedDocsSlug } from '#/docs/moved-pages'
import { DocsNotFoundContent } from '#/docs/not-found-content'
import { DocsPageContent } from '#/docs/page-content'
import { getDocsPage } from '#/docs/transport'
import { pageHead } from '#/lib/page-head'

/**
 * Every document: `/docs/dev`, `/docs/dev/plugins/create`, `/docs/ui/button`.
 *
 * One splat route, and deliberately the narrowest one that works. A `/$` at the
 * root would have swallowed `/discover`, `/settings`, every plugin route and
 * every URL the Next.js application still serves; `/docs/$` claims exactly the
 * documentation and nothing else. `src/tests/docs-route.test.ts` pins that.
 *
 * There is **no `$lang` in this tree, and there is not going to be**. Fumadocs'
 * own TanStack examples route documentation as `/$lang/docs/$` because they have
 * no other locale mechanism; VitNode has had one since Stage 3. `/pl/docs/dev`
 * arrives, the router's `rewrite.input` strips the prefix, this route matches
 * `/docs/dev`, and every link Fumadocs renders gets the prefix back on the way
 * out. A physical `$lang` segment would be a second locale model competing with
 * that one, and the two would disagree the first time a language was added.
 *
 * ## The loader does the whole lookup, and `head` does none of it
 *
 * `getDocsPage` is a server function because Fumadocs' source loader is a
 * build-time index of every document and may not reach the browser - see
 * `src/docs/transport.ts`. It answers with the page's identity and metadata, and
 * that one object feeds the `<title>`, the `<h1>` and the body. The Next.js page
 * looked the page up twice, once in `generateMetadata` and once in the
 * component; here `head` reads `loaderData` and looks nothing up.
 *
 * **`head` is written after `loader`**: `loaderData`'s type is inferred from
 * `loader` in the same object literal, and TypeScript reads a literal's members
 * in order. Put `head` first and `loaderData` is `never`.
 *
 * `metaTitle` rather than `title`, because they are different strings on
 * purpose: the tab reads "Create a plugin - Plugins - Development" and the
 * heading reads "Create a plugin". Both are composed on the server, from the
 * page tree, exactly as the Next.js application composed them.
 *
 * ## The Open Graph is the same string without the site name
 *
 * `og:title` is `metaTitle` **verbatim**, while `<title>` is `metaTitle` plus
 * ` - VitNode`. That is not an oversight, it is what the Next.js route emitted -
 * Next applies `title.template` to the document title and leaves
 * `openGraph.title` alone - and it is what a social card wants: "Routes -
 * Plugins" over a link to vitnode.com, rather than the site's name twice.
 * Measured against the running Next.js application rather than inferred; see
 * `@vitnode/core/tanstack/metadata`.
 *
 * ## Why the body is preloaded here
 *
 * `docsClientLoader.preload` starts the `import()` of this page's compiled MDX
 * chunk, and awaiting it is what makes the first paint contain the document
 * rather than a suspended boundary - on the server as much as in the browser.
 * The `await import()` around it is what keeps that chunk, `fumadocs-ui/page`
 * and the MDX component map out of the client entry: a static import here would
 * put the whole documentation runtime in front of every visitor to `/`, because
 * a route's `loader` is not code-split. See `src/tests/asset-graph.test.ts`,
 * which fails if any chunk the front page preloads mentions Fumadocs.
 *
 * ## The 404 belongs here, not on the shell
 *
 * `getDocsPage` throws `notFound()` for a slug the collection has no document
 * for, and a not-found component replaces the render of the route it is declared
 * on. Declared on `_docs` it would replace the *shell*, taking the sidebar and
 * the navigation with it - and Fumadocs' `DocsPage` throws outright without the
 * tree context that shell provides. Declared here it renders in the shell's
 * `<Outlet />`, which is what a reader who mistyped a URL actually wants.
 *
 * ## A moved document redirects before the lookup
 *
 * `beforeLoad` runs before the loader, so a slug that used to name a document
 * never reaches `getDocsPage` and never becomes a 404. See
 * `src/docs/moved-pages.ts` for the map, and note the `301`: the reorganisation
 * is permanent, so the old URL should hand its ranking to the new one rather
 * than keep it.
 */
export const Route = createFileRoute('/_docs/docs/$')({
  beforeLoad: ({ params }) => {
    const moved = movedDocsSlug(params._splat ?? '')

    if (moved) {
      throw redirect({
        params: { _splat: moved },
        statusCode: 301,
        to: '/docs/$',
      })
    }
  },
  loader: async ({ params }) => {
    const page = await getDocsPage({ data: params._splat ?? '' })
    const { docsClientLoader } = await import('#/docs/client-loader')

    await docsClientLoader.preload(page.path)

    return page
  },
  head: ({ loaderData }) =>
    pageHead({
      description: loaderData?.description,
      openGraph: {
        description: loaderData?.description,
        title: loaderData?.metaTitle,
        type: 'article',
      },
      robots: 'index, follow',
      title: loaderData?.metaTitle,
    }),
  notFoundComponent: DocsNotFoundContent,
  component: DocsRoute,
})

function DocsRoute() {
  return <DocsPageContent {...Route.useLoaderData()} />
}
