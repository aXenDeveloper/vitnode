import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { getRouter } from '#/router'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))
const routesDir = resolve(here, '../routes')
const repoRoot = resolve(here, '../../../..')
const coreTanstackDir = resolve(repoRoot, 'packages/vitnode/src/tanstack')
const pluginsDir = resolve(repoRoot, 'plugins')

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
    ['/files', 'the files table, behind the session guard'],
    // Stage 9. The settings subtree joins the shell rather than bringing a
    // second header of its own: the layout is a child of the guard, which is a
    // child of the shell, so a panel gets the header, the breadcrumb area, the
    // `<main>` landmark and the guard from where its file lives.
    ['/settings', 'the settings root, behind the same guard'],
    ['/settings/overview', 'a settings panel'],
    ['/settings/devices', 'the devices panel'],
    ['/settings/security', 'the security panel'],
    ['/example', "a plugin's page, mounted by area rather than by file"],
  ])('%s renders in the shell (%s)', (pathname) => {
    expect(matchedIds(pathname)).toContain(MAIN_SHELL_ROUTE_ID)
  })

  /**
   * An auth screen is a full-height card on an otherwise empty document, and the
   * header it would render has one interesting control on it: "sign in". Keeping
   * these out is what makes the shell something routes opt into.
   *
   * Stage 9 is what makes that a policy rather than an accident of what had been
   * migrated: registration and password recovery moved in, and they moved in
   * *here* - outside the shell, alongside `/login` - rather than under `_main`.
   */
  it.each([
    ['/login', 'the login screen'],
    ['/login/sso/google', 'the SSO callback'],
    ['/register', 'the registration screen'],
    ['/login/reset-password', 'the password-recovery screens'],
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
   * The screens outside the shell own theirs, and must: without a shell above
   * them, a login screen with no `<main>` is a document with no main landmark at
   * all.
   *
   * Stage 10 moved those screens into `@vitnode/core/tanstack/auth`, so the
   * landmark moved with them - the route files below are now topology and
   * nothing else, which the second assertion pins.
   */
  it.each([
    ['auth/login-route.tsx', 'login.tsx', 1],
    ['auth/sso-route.tsx', 'login_.sso.$providerId.tsx', 1],
    // Stage 9. Registration and password recovery join the blank-auth area, so
    // they own their landmark for the same reason.
    ['auth/register-route.tsx', 'register.tsx', 1],
    // Two, and both correct: the page body and the `notFoundComponent` the route
    // mounts, which replaces it on an install with no email adapter. They are
    // alternatives, so a document still renders exactly one.
    ['auth/recovery-route.tsx', 'login_.reset-password.tsx', 2],
  ] as const)(
    '%s renders %i <main>, and its route file none',
    (module, route, count) => {
      expect(
        landmarks(withoutComments(join(coreTanstackDir, module))),
      ).toHaveLength(count)
      expect(landmarks(withoutComments(join(routesDir, route)))).toEqual([])
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
 * The breadcrumb rule itself is not tested here any more.
 *
 * It moved with the component that applies it: `breadcrumbOf` is
 * `@vitnode/core/tanstack/breadcrumb`'s, and `model.test.ts` in that package
 * covers the fold - deepest declaration wins, `undefined` falls through, `null`
 * clears. What is still this app's to state is which of *its* routes declare
 * one, which `settings-routes.test.ts` asserts against the real route tree.
 */

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
  // The prose in that module discusses `ensureAuthState` at length in order to
  // explain why it is the wrong call here, so a scan that read the comments
  // would find the very thing it is asserting the absence of.
  //
  // Stage 10 moved the shell's loader into the module that owns both reads,
  // which is what makes the first two assertions structural rather than
  // stylistic: the loader and the header are now the same file.
  const shell = withoutComments(join(coreTanstackDir, 'layout/header.tsx'))

  it('is the loader the shell route actually uses', () => {
    // Without this the assertions below are about a function nobody calls.
    expect(withoutComments(join(routesDir, '_main.tsx'))).toContain(
      'loadMainShell(context)',
    )
    expect(shell).toContain('export const loadMainShell')
  })

  it('ensures the header’s messages, whose absence would suspend the document', () => {
    expect(shell).toContain('headerIntlQueryOptions')
    expect(shell).toContain('ensureQueryData')
  })

  it('takes the message options from the header rather than restating them', () => {
    // The namespace list is part of the query key, so a loader that spelled its
    // own out would warm a key the header never reads.
    expect(shell).toContain('headerIntlQueryOptions({ locale })')
  })

  it('prefetches the session rather than ensuring it', () => {
    expect(shell).toContain('prefetchSession')
    expect(shell).not.toContain('ensureAuthState')
  })
})
