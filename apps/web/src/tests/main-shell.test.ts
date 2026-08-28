import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { BreadcrumbMatch } from '#/lib/breadcrumb'

import { breadcrumbOf } from '#/lib/breadcrumb'
import { getRouter } from '#/router'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))
const routesDir = resolve(here, '../routes')
const pluginsDir = resolve(here, '../../../../plugins')

/** The pathless route that renders the header, the breadcrumb area and `<main>`. */
const MAIN_SHELL_ROUTE_ID = '/_main'

const matchedIds = (pathname: string): string[] =>
  getRouter()
    .matchRoutes(pathname, undefined)
    .map((match) => match.routeId)

/**
 * Which routes render inside the main application shell, and which do not.
 *
 * A route joins the shell by where its file lives - `routes/_main/search.tsx` is
 * `/search`, in the shell - so the policy is not written down anywhere except
 * the route tree itself. That is the point of asserting it here: the tree is the
 * declaration, and this is the sentence it declares, in one place, where moving
 * a file out of the shell by accident fails a test rather than silently removing
 * a page's header.
 *
 * `matchRoutes` runs no `beforeLoad`, so the two guarded pages are matched here
 * without a session. What is being asserted is the parent chain, not access.
 */
describe('the main shell is what a public page renders inside', () => {
  it.each([
    ['/', 'the front page'],
    ['/discover', 'the discover feed'],
    ['/search', 'the search page'],
    ['/account', 'a page behind the session guard'],
    ['/files', 'the files table, behind the same guard'],
    ['/example', "a plugin's page, mounted by area rather than by file"],
  ])('%s renders in the shell (%s)', (pathname) => {
    expect(matchedIds(pathname)).toContain(MAIN_SHELL_ROUTE_ID)
  })

  /**
   * An auth screen is a full-height card on an otherwise empty document, and the
   * header it would render has one interesting control on it: "sign in". Keeping
   * these out is what makes the shell something routes opt into - and it is the
   * shape `/register` and the password-reset screens will want when they move.
   */
  it.each([
    ['/login', 'the login screen'],
    ['/login/sso/google', 'the SSO callback'],
  ])('%s renders outside it (%s)', (pathname) => {
    expect(matchedIds(pathname)).not.toContain(MAIN_SHELL_ROUTE_ID)
  })

  /**
   * The guard sits *under* the shell rather than beside it, which is what stops
   * `/files` from needing a second copy of the header. Asserted as order: the
   * shell is matched before the guard, so it is the guard's parent.
   */
  it('puts the session guard inside the shell rather than next to it', () => {
    const matched = matchedIds('/files')

    expect(matched.indexOf(MAIN_SHELL_ROUTE_ID)).toBeGreaterThanOrEqual(0)
    expect(matched.indexOf(MAIN_SHELL_ROUTE_ID)).toBeLessThan(
      matched.indexOf(`${MAIN_SHELL_ROUTE_ID}/_authenticated`),
    )
  })
})

const routeFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)

    if (statSync(path).isDirectory()) return routeFiles(path)

    return name.endsWith('.tsx') ? [path] : []
  })

/**
 * One `<main>` per document, and the shell owns it.
 *
 * A page that renders its own `<main>` inside a shell that also renders one
 * produces two: invalid HTML, and a screen reader with two "main" landmarks to
 * choose from. A page under the shell keeps its container - its width, its
 * padding, its vertical rhythm - as a `<div>`.
 *
 * `<main>` is not something a type can forbid, so this reads the source. Crude,
 * and exactly as crude as the mistake it catches.
 */
describe('the shell owns the main landmark', () => {
  /**
   * The file's code, with its comments removed.
   *
   * Every one of these routes *documents* the landmark it does or does not
   * render, so a scan of the raw source would find `<main>` in the prose above
   * the component and fail on the explanation rather than on the markup.
   */
  const landmarks = (code: string): string[] => code.match(/<main[\s>]/g) ?? []

  const under = (directory: string) =>
    routeFiles(directory).map((path) => ({
      code: withoutComments(path),
      name: relative(routesDir, path).split(sep).join('/'),
    }))

  it.each(under(join(routesDir, '_main')))(
    '$name renders no <main> of its own',
    ({ code }) => {
      expect(landmarks(code)).toEqual([])
    },
  )

  it('renders no <main> in the shell route either - it comes from core', () => {
    // `ThemeLayoutContent` is the one place the landmark is written, shared with
    // the Next.js app so the two runtimes produce the same document.
    const code = withoutComments(join(routesDir, '_main.tsx'))

    expect(landmarks(code)).toEqual([])
    expect(code).toContain('ThemeLayoutContent')
  })

  /**
   * The routes outside the shell own theirs, and must: without a shell above
   * them, a login screen with no `<main>` is a document with no main landmark at
   * all.
   */
  it.each(['login.tsx', 'login_.sso.$providerId.tsx'])(
    '%s renders exactly one <main> of its own',
    (name) => {
      expect(landmarks(withoutComments(join(routesDir, name)))).toHaveLength(1)
    },
  )

  /**
   * The same rule, for the pages this app does not own.
   *
   * A plugin route declares `area: "main"`, which mounts it inside the shell -
   * so a plugin page that renders a `<main>` produces the nested landmark from
   * source this app cannot edit. Scanned rather than trusted, because the
   * failure is invisible: the page renders, the HTML is merely wrong.
   */
  const pluginRouteFiles = readdirSync(pluginsDir)
    .map((name) => join(pluginsDir, name, 'src', 'routes'))
    .filter((path) => existsSync(path))
    .flatMap(routeFiles)

  it('finds the plugin route modules it means to scan', () => {
    // Without this the assertion below passes on an empty list.
    expect(pluginRouteFiles.length).toBeGreaterThan(0)
  })

  it.each(pluginRouteFiles)('%s renders no <main> of its own', (path) => {
    expect(landmarks(withoutComments(path))).toEqual([])
  })
})

/**
 * The breadcrumb rule, as a function over plain data.
 *
 * Deepest declaring match wins, which is the same answer Next's `@breadcrumb`
 * slot gives: the deepest folder with a `page.tsx`, with everything above it
 * falling through. Tested without a router because it *is* a function over
 * `{ staticData }` - see `#/lib/breadcrumb`.
 */
describe('a route declares its own breadcrumb, and the deepest one wins', () => {
  const root = 'root crumb'
  const leaf = 'leaf crumb'

  const match = (...declared: React.ReactNode[]): BreadcrumbMatch => ({
    // Spread rather than an optional parameter, so "declared `null`" and
    // "declared nothing" are two different calls rather than one value.
    staticData: declared.length > 0 ? { breadcrumb: declared[0] } : {},
  })

  it('takes the deepest declaration, not the first', () => {
    expect(breadcrumbOf([match(root), match(), match(leaf)])).toBe(leaf)
  })

  it('falls back to an ancestor when the leaf declares nothing', () => {
    expect(breadcrumbOf([match(root), match(), match()])).toBe(root)
  })

  /**
   * The legacy slot's `page.tsx` returning `null` - `/` has one, so that a
   * client-side navigation home clears the crumb the previous page rendered.
   */
  it('lets a child clear an ancestor’s crumb by declaring null', () => {
    expect(breadcrumbOf([match(root), match(null)])).toBeNull()
  })

  it('answers with nothing when no match declares one', () => {
    expect(breadcrumbOf([match(), match()])).toBeNull()
  })

  it('answers with nothing for no matches at all', () => {
    expect(breadcrumbOf([])).toBeNull()
  })
})

/**
 * What the shell warms before it renders, and why each one is the call it is.
 *
 * The header is above every page in the shell, so both of its reads have to be
 * in hand before the first paint. They are also the two reads whose *failure
 * modes* differ, and the pair is easy to get subtly wrong in either direction:
 *
 *     headerIntlQueryOptions  ensure    a `useSuspenseQuery` with no boundary
 *                                       between it and the document
 *     session                 prefetch  a rejection here would replace every
 *                                       page on the site with an error screen
 *
 * `ensureAuthState` is the tempting call for the second one - it is what
 * `_authenticated` uses two routes down - and it is wrong here for exactly the
 * reason it is right there. A source scan is the honest way to pin that: what is
 * being asserted is which function the loader calls, and both reach the same
 * cache entry, so no observable behaviour distinguishes them until the API is
 * down.
 */
describe('the shell warms what the header reads', () => {
  // The prose in that file discusses `ensureAuthState` at length in order to
  // explain why it is the wrong call here, so a scan that read the comments
  // would find the very thing it is asserting the absence of.
  const shell = withoutComments(join(routesDir, '_main.tsx'))

  it('ensures the header’s messages, whose absence would suspend the document', () => {
    expect(shell).toContain('headerIntlQueryOptions')
    expect(shell).toContain('ensureQueryData')
  })

  it('takes the message options from the header rather than restating them', () => {
    // The namespace list is part of the query key, so a loader that spelled its
    // own out would warm a key the header never reads.
    expect(shell).toContain(
      "import { headerIntlQueryOptions } from '#/components/header'",
    )
  })

  it('prefetches the session rather than ensuring it', () => {
    expect(shell).toContain('prefetchSession')
    expect(shell).not.toContain('ensureAuthState')
  })
})
