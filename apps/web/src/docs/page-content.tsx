import type { DocsPageData } from './transport'

import { docsClientLoader } from './client-loader'

/**
 * One document, rendered from what its route's loader resolved.
 *
 * Small, and its own module for a reason that is not size: it is the first thing
 * in the documentation graph that reaches Fumadocs' UI, and the route may only
 * name it through `component`. A route's `loader` and `head` are evaluated in
 * the client entry on *every* page of the application, so an import the route
 * file made statically would put the documentation runtime in front of every
 * visitor to the front page.
 *
 * `path` selects the compiled MDX module; the rest is what the page looks like
 * around it. Both come from the one server-side lookup the loader made, so the
 * `<h1>`, the `<title>` and the body cannot disagree - see `./transport`.
 *
 * `metaTitle` is deliberately not passed on: it is the tab's title, with the
 * page's ancestors appended, and the heading shows `title`.
 *
 * `useContent` reads the module through `use()`, so a body that somehow was not
 * preloaded suspends rather than flashing empty.
 */
export const DocsPageContent = (page: DocsPageData): React.ReactNode =>
  docsClientLoader.useContent(page.path, {
    description: page.description,
    full: page.full,
    githubUrl: page.githubUrl,
    title: page.title,
    url: page.url,
  })
