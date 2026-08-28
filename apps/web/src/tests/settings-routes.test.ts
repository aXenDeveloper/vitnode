import {
  activeSettingsNavKey,
  isSettingsNavItemActive,
  isSettingsRootPath,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from '@vitnode/core/views/auth/settings/settings-nav'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { BreadcrumbMatch } from '#/lib/breadcrumb'

import { breadcrumbOf } from '#/lib/breadcrumb'
import { isTanStackOwnedPath } from '#/lib/migration-navigation'
import { getRouter } from '#/router'

import { withoutComments } from './source'

const here = dirname(fileURLToPath(import.meta.url))
const settingsDir = resolve(here, '../routes/_main/_authenticated/settings')
const layoutRoute = resolve(here, '../routes/_main/_authenticated/settings.tsx')

/**
 * The settings navigation, as data.
 *
 * Shared by both frameworks (`packages/vitnode/src/views/auth/settings/
 * settings-nav.ts`), which is the reason it is worth pinning here rather than
 * only in the package: this app's route tree has to offer exactly the panels the
 * menu lists, and a menu entry with no route behind it is a link to a 404.
 */
describe('the settings navigation model', () => {
  it('lists the three panels the settings screens have, in order', () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.key)).toEqual([
      'overview',
      'devices',
      'security',
    ])
  })

  it('gives every item an href under the settings root', () => {
    for (const item of SETTINGS_NAV_ITEMS) {
      expect(item.href.startsWith(`${SETTINGS_ROOT_HREF}/`)).toBe(true)
    }
  })

  it('mentions no locale anywhere', () => {
    // The prefix is the router's rewrite and `MigrationLink`'s job. An href
    // spelled `/pl/settings/...` here would be localized twice.
    for (const item of SETTINGS_NAV_ITEMS) {
      for (const href of [item.href, ...item.aliases]) {
        expect(href).not.toMatch(/^\/[a-z]{2}\//)
      }
    }
  })

  it('answers each panel href with its own key', () => {
    expect(activeSettingsNavKey('/settings/overview')).toBe('overview')
    expect(activeSettingsNavKey('/settings/devices')).toBe('devices')
    expect(activeSettingsNavKey('/settings/security')).toBe('security')
  })

  it('resolves a key back to the href the menu renders', () => {
    for (const item of SETTINGS_NAV_ITEMS) {
      expect(settingsNavHref(item.key)).toBe(item.href)
    }
  })

  /**
   * The alias, which is the whole of `/settings`' active-state behaviour: the
   * root screen renders the overview panel, so the menu has to show *Overview*
   * as current on it. Without this the root screen is a menu with nothing
   * selected.
   */
  it('marks Overview as current on the settings root', () => {
    expect(activeSettingsNavKey(SETTINGS_ROOT_HREF)).toBe('overview')
  })

  it('ignores a trailing slash, which is not a different page', () => {
    expect(activeSettingsNavKey('/settings/')).toBe('overview')
    expect(activeSettingsNavKey('/settings/security/')).toBe('security')
    expect(isSettingsRootPath('/settings/')).toBe(true)
  })

  it('selects nothing outside the settings screens', () => {
    expect(activeSettingsNavKey('/files')).toBeUndefined()
    expect(activeSettingsNavKey('/')).toBeUndefined()
    // A settings path with no menu entry - a panel reachable by URL before it is
    // listed. Nothing selected is the honest answer.
    expect(activeSettingsNavKey('/settings/notifications')).toBeUndefined()
  })

  it('never lights up a panel from a longer path that starts with it', () => {
    // A prefix rule would mark Security current on a child of it, which is the
    // same mistake `isTanStackOwnedPath` guards against for ownership.
    expect(activeSettingsNavKey('/settings/security/sessions')).toBeUndefined()
  })

  it('is the root only at the root', () => {
    expect(isSettingsRootPath(SETTINGS_ROOT_HREF)).toBe(true)
    expect(isSettingsRootPath('/settings/overview')).toBe(false)
    expect(isSettingsRootPath('/settingsx')).toBe(false)
  })

  it('marks exactly one item active on any settings path', () => {
    for (const pathname of [
      SETTINGS_ROOT_HREF,
      '/settings/overview',
      '/settings/devices',
      '/settings/security',
    ]) {
      const active = SETTINGS_NAV_ITEMS.filter((item) =>
        isSettingsNavItemActive(item, pathname),
      )

      expect(active).toHaveLength(1)
    }
  })
})

/**
 * The route tree beneath the settings layout.
 *
 * `matchRoutes` runs no `beforeLoad`, so these paths are matched without a
 * session. What is being asserted is the parent chain - that every panel is
 * inside the shell, inside the session guard and inside the settings layout -
 * rather than access.
 */
describe('every settings panel is a child of the layout and the guard', () => {
  const matchedIds = (pathname: string): string[] =>
    getRouter()
      .matchRoutes(pathname, undefined)
      .map((match) => match.routeId)

  it.each([
    '/settings',
    '/settings/overview',
    '/settings/devices',
    '/settings/security',
  ])(
    '%s renders inside the shell, the guard and the settings layout',
    (path) => {
      expect(matchedIds(path)).toEqual(
        expect.arrayContaining([
          '/_main',
          '/_main/_authenticated',
          '/_main/_authenticated/settings',
        ]),
      )
    },
  )

  /**
   * Every destination the menu offers is one this app renders itself.
   *
   * This is what "the settings navigation is ordinary owned-route navigation"
   * amounts to, stated as a property rather than as a choice of component. The
   * menu is handed `MigrationLink`, which asks the route tree per href and does a
   * full document load into the Next.js app for anything this one does not serve
   * - correct behaviour, and invisible when it happens. With every Stage 9 panel
   * migrated the answer should now be "owned" for all of them, so this fails if a
   * menu entry is added without a route behind it, or if a panel's route is moved
   * out from under the layout.
   */
  it.each(SETTINGS_NAV_ITEMS)(
    'the $key menu entry is a client-side navigation',
    ({ href }) => {
      expect(isTanStackOwnedPath(getRouter(), href)).toBe(true)
    },
  )

  it('and so is the settings root the menu falls back to', () => {
    expect(isTanStackOwnedPath(getRouter(), SETTINGS_ROOT_HREF)).toBe(true)
  })

  /**
   * The alias, at the level of the route tree: `/settings` is served by the
   * layout's *index* child rather than by a redirect, so it is a page in its own
   * right and the deepest match consumes the whole path.
   */
  it('serves the settings root from an index child, not a redirect', () => {
    expect(matchedIds('/settings').at(-1)).toBe(
      '/_main/_authenticated/settings/',
    )
    expect(withoutComments(`${settingsDir}/index.tsx`)).not.toContain(
      'redirect',
    )
  })

  it('renders the same panel component at the root and at /settings/overview', () => {
    // The visible half of the alias. Two routes, one component - so the two URLs
    // cannot drift into two different overview screens.
    for (const file of ['index.tsx', 'overview.tsx']) {
      expect(withoutComments(`${settingsDir}/${file}`)).toContain(
        'OverviewSettings',
      )
    }
  })
})

/**
 * What the panels do *not* do, which in this subtree is most of it.
 *
 * The frame, the session check and the robots directive all belong to exactly one
 * route, and a panel that quietly acquired its own copy of any of them would keep
 * working while the two copies drifted. A source scan is the honest way to pin
 * "this file does not contain that", and `withoutComments` is what stops the
 * prose above each route - which discusses every one of these by name in order to
 * say where it really lives - from matching.
 */
describe('a settings panel owns only its own contents', () => {
  const panels = ['index.tsx', 'overview.tsx', 'security.tsx', 'devices.tsx']

  it.each(panels)('%s adds no session check of its own', (file) => {
    const code = withoutComments(`${settingsDir}/${file}`)

    expect(code).not.toContain('ensureAuthState')
    expect(code).not.toContain('getSession')
    expect(code).not.toContain('RequireSession')
  })

  it.each(panels)('%s does not restate the robots directive', (file) => {
    // The layout declares `noindex, nofollow` once and TanStack Router merges
    // the `head` of every matched route, so the subtree inherits it.
    expect(withoutComments(`${settingsDir}/${file}`)).not.toContain('robots')
  })

  it.each(panels)('%s does not render the shell a second time', (file) => {
    const code = withoutComments(`${settingsDir}/${file}`)

    expect(code).not.toContain('SettingsShellContent')
    expect(code).not.toContain('SettingsNavContent')
  })

  it('declares the robots directive exactly once, on the layout', () => {
    expect(withoutComments(layoutRoute)).toContain("name: 'robots'")
  })

  it('puts the session guard nowhere in the subtree', () => {
    expect(withoutComments(layoutRoute)).not.toContain('ensureAuthState')
  })
})

/**
 * The breadcrumb, as the data each route declares rather than as rendered markup.
 *
 * `breadcrumbOf` is already covered in `main-shell.test.ts`; what is new here is
 * that this is the first subtree to use it for a *nested* trail, so the question
 * worth asking is which route declares what.
 */
describe('the settings breadcrumb is declared by routes, deepest first', () => {
  const matched = (pathname: string): BreadcrumbMatch[] =>
    getRouter().matchRoutes(pathname, undefined)

  /**
   * How many of the matched routes declared a crumb at all.
   *
   * Counted rather than collected: `React.ReactNode` includes a promise in React
   * 19's types, so a helper that *returned* the declarations reads as an async
   * function to every rule that scans for one.
   */
  const declaringMatches = (pathname: string): number =>
    matched(pathname).filter(
      (match) => match.staticData.breadcrumb !== undefined,
    ).length

  /**
   * The crumb the shell would render, as the element it is.
   *
   * Typed as the props this suite reads rather than as `React.ReactNode`: that
   * type includes a promise in React 19, which makes every function returning
   * one look like an async component to the rules that scan for them.
   */
  const crumbOf = (pathname: string): { props: { navKey?: string } } =>
    breadcrumbOf(matched(pathname)) as { props: { navKey?: string } }

  it('gives the settings root the layout’s own single crumb', () => {
    // The index route declares nothing, so the trail falls through to the
    // layout's - which is what the Next.js `@breadcrumb/settings` slot renders.
    expect(declaringMatches('/settings')).toBe(1)
  })

  it.each(['/settings/overview', '/settings/security', '/settings/devices'])(
    '%s declares its own trail, which wins by being deeper',
    (pathname) => {
      expect(declaringMatches(pathname)).toBe(2)
    },
  )

  /**
   * The whole subtree, as the crumb each URL actually resolves to.
   *
   * The label comes from the navigation model rather than from a pathname
   * registry, so what a route declares is the key it already uses for its own
   * tab title - and `undefined` is the root's answer rather than a missing one,
   * because the layout's crumb is the single "Settings" trail.
   *
   * Stated as one table over all four URLs because this is the seam: the layout,
   * two panels and the devices panel were written separately, and a crumb that
   * resolved to the wrong depth would look right on whichever page its author
   * was reading.
   */
  it.each([
    ['/settings', undefined],
    ['/settings/overview', 'overview'],
    ['/settings/devices', 'devices'],
    ['/settings/security', 'security'],
  ] as const)('%s resolves to the %s crumb', (pathname, navKey) => {
    expect(crumbOf(pathname).props.navKey).toBe(navKey)
  })
})
