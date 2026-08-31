import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DOCS_TREE_STALE_TIME } from '#/docs/freshness'
import { DocsShellContent } from '#/docs/shell-content'
import { getDocsPageTree } from '#/docs/transport'

/**
 * The documentation's shell - the third one this application has, beside `_main`
 * and `_admin`.
 *
 * Pathless, so it contributes no URL segment: `/docs/dev` is `/docs/dev`. A
 * documentation route joins this shell by *where its file lives*, which is the
 * same rule the other two shells use.
 *
 * ## Why the docs are not under `_main`
 *
 * Because they already have a shell. Fumadocs' notebook layout is a top bar with
 * the mark, the GitHub link, a search trigger and the theme switcher, plus a
 * sidebar of sections and a table of contents - which is `MainHeader`'s job done
 * a second time, for a second navigation. Nesting them would put two site
 * headers, two search triggers and two theme switchers on every documentation
 * page. So this sits beside `_main`, and `__root` stays the one document above
 * all three.
 *
 * ## What it owns
 *
 *     __root      the document, the VitNode providers, the theme
 *      ├── _main  the public site: header, breadcrumb, one <main>
 *      ├── _docs  this: the Fumadocs providers, the docs navigation
 *      └── _admin the AdminCP: its own session, its own sidebar
 *
 * The loader fetches the sidebar's tree, once, for the whole subtree - a page
 * route below fetches only its own document.
 *
 * `DOCS_TREE_STALE_TIME` is `Infinity` in production, because the tree is build
 * output: identical for every visitor, unchanged for the life of the process, so
 * re-fetching it on each navigation within the documentation would be a round
 * trip for a constant. In development it is `0`, so that adding or renaming a
 * page shows up in the sidebar on the next navigation rather than on the next
 * server restart. See `#/docs/freshness`, which owns both halves.
 *
 * There is deliberately **no stylesheet declared here**. Fumadocs' design system
 * was a route-owned `<link>` for exactly one build, and `src/styles.css` records
 * at length why it could not stay one: TanStack renders every stylesheet with a
 * React `precedence`, which hoists it permanently, so a second Tailwind build
 * ends up on every page of the application and its `@layer utilities` overrides
 * the app's own. The documentation's CSS is in `src/styles.css` with everything
 * else.
 *
 * There is deliberately **no `notFoundComponent` here**. A route's not-found
 * component replaces that route's own render, so one declared on the shell would
 * take the sidebar and the navigation down with the missing page - Fumadocs'
 * `DocsPage` then has no tree context and throws outright. It belongs on the
 * page route below, where it lands in this shell's `<Outlet />`.
 */
export const Route = createFileRoute('/_docs')({
  loader: async () => ({ pageTree: await getDocsPageTree() }),
  staleTime: DOCS_TREE_STALE_TIME,
  component: DocsShell,
})

function DocsShell() {
  const { pageTree } = Route.useLoaderData()

  return (
    <DocsShellContent pageTree={pageTree}>
      <Outlet />
    </DocsShellContent>
  )
}
