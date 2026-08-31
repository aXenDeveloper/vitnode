/**
 * What vitnode.com's front page says it is, to a crawler and to a browser tab.
 *
 * Its own module, and deliberately not next to the markup it describes. A
 * route's `head` is one of the options TanStack Start's code splitter leaves
 * behind in the client entry - so whatever module `head` reads from is loaded on
 * every page of the application, `/settings/security` included. Exporting these
 * two strings from `home-content.tsx` would put the hero, the marquee, the
 * AdminCP screenshot and `motion` in that entry. It is the same split
 * `@vitnode/core/tanstack/*` makes between a namespace's `route.tsx` and its
 * `screen.tsx`, for the same reason, and `src/tests/eager-graph.test.ts` is what
 * holds the route files to it.
 */

/**
 * The page's own title, before the site's name is appended.
 *
 * `pageHead` runs it through `formatPageTitle`, so the tab reads
 * `"Community Framework for Building Apps - VitNode"` - the same
 * `"<page> - <site>"` rule Next.js applies through `title.template`, and the
 * reason this string does not repeat "VitNode" itself. The Next.js page it
 * replaces set the whole title by hand and got `"VitNode: Community Framework
 * for Building Apps - VitNode"` out of the template; the words and their order
 * are preserved, the second VitNode is not.
 */
export const HOME_TITLE = 'Community Framework for Building Apps'

/**
 * The `<meta name="description">`.
 *
 * One word changed from the Next.js page's: it opened `"Build with Next.js and
 * Hono.js"`, and after this stage the application a visitor is reading is served
 * by TanStack Start. Naming Next.js as VitNode's frontend runtime is now simply
 * a false statement about the page it appears on. Everything after the first
 * sentence is the copy as it was - this is a migration, not a rewrite of the
 * product's positioning.
 */
export const HOME_DESCRIPTION =
  'Build with TanStack Start and Hono.js. It provides a structured, plugin-based architecture with Admin Control Panel that makes development faster and less complex.'
