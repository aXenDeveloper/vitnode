import {
  LOGIN_NAMESPACES,
  passwordResetNamespaces,
  REGISTER_NAMESPACES,
  SSO_CALLBACK_NAMESPACES,
} from '@vitnode/core/tanstack/auth'
import { MY_FILES_NAMESPACES } from '@vitnode/core/tanstack/files'
import { HEADER_NAMESPACES } from '@vitnode/core/tanstack/layout'
import {
  DISCOVER_NAMESPACES,
  SEARCH_NAMESPACES,
} from '@vitnode/core/tanstack/search'
import { SETTINGS_NAMESPACES } from '@vitnode/core/tanstack/settings'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { loadIntlMessages } from '#/server/messages.server'

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appSrc, '../../..')
const read = (path: string) => readFileSync(join(appSrc, path), 'utf8')
const readCore = (path: string) =>
  readFileSync(join(repoRoot, 'packages/vitnode/src/tanstack', path), 'utf8')

/**
 * The route → namespace audit, as a test rather than as a document.
 *
 * Three separate things have to agree for one page to render in the language
 * its URL claims, and none of them is visible from the others:
 *
 *     the loader        ensures  intlQueryOptions({ locale, namespaces })
 *     the provider      reads    the same options back, by the same key
 *     the Polish file   carries  a branch for each of those namespaces
 *
 * The first two disagreeing is a suspend on a key nobody warmed - a page that
 * blanks for a round trip, or on a language switch does not repaint at all. The
 * third missing is the quieter one, and the one that produced the Stage 9
 * report: every screen renders, `<html lang>` says `pl`, the dates are Polish,
 * and the copy is English - which looks exactly like a broken locale runtime
 * from the outside.
 *
 * The namespace lists below are the audit table. They are written out rather
 * than taken from the constants so that changing a route's set has to be a
 * deliberate edit here too.
 *
 * Stage 10 moved every one of these constants - and the loader and the provider
 * that have to agree with it - into `@vitnode/core/tanstack/*`, which is why the
 * source scans below read the package rather than `apps/web/src/routes`. The
 * audit did not change; the address of the thing being audited did, and the
 * route files that used to hold it are now four lines each.
 */

/** Every namespace set a migrated route declares, and where it now lives. */
const ROUTES = [
  {
    constant: 'DISCOVER_NAMESPACES',
    declared: DISCOVER_NAMESPACES,
    module: 'search/discover-route.tsx',
    namespaces: ['core.global', 'core.search'],
    route: '/discover',
  },
  {
    constant: 'SEARCH_NAMESPACES',
    declared: SEARCH_NAMESPACES,
    module: 'search/search-route.tsx',
    namespaces: ['core.global', 'core.search'],
    route: '/search',
  },
  {
    constant: 'LOGIN_NAMESPACES',
    declared: LOGIN_NAMESPACES,
    module: 'auth/login-route.tsx',
    namespaces: ['core.global', 'core.auth.sign_in', 'core.auth.sso'],
    route: '/login',
  },
  {
    constant: 'REGISTER_NAMESPACES',
    declared: REGISTER_NAMESPACES,
    module: 'auth/register-route.tsx',
    namespaces: ['core.global', 'core.auth.sign_up', 'core.auth.sso'],
    route: '/register',
  },
  {
    constant: 'SSO_CALLBACK_NAMESPACES',
    declared: SSO_CALLBACK_NAMESPACES,
    module: 'auth/sso-route.tsx',
    namespaces: ['core.global', 'core.auth.sso'],
    route: '/login/sso/$providerId',
  },
  {
    constant: 'MY_FILES_NAMESPACES',
    declared: MY_FILES_NAMESPACES,
    module: 'files/route.tsx',
    namespaces: ['core.files', 'core.global'],
    route: '/files',
  },
] as const

describe.each(ROUTES)('$route declares one namespace set', (entry) => {
  it('declares the set this audit expects', () => {
    expect([...entry.declared]).toEqual([...entry.namespaces])
  })

  it('warms it in the loader and mounts the same constant', () => {
    // The same identifier in both places, not two lists that happen to match:
    // the namespace list is part of the query key, so a loader that warmed a
    // different set warmed a key nobody reads. Both halves are now in one
    // module, which is most of why the route file no longer needs to know.
    const source = readCore(entry.module)
    const mount = `<RouteMessages namespaces={${entry.constant}}>`

    expect(source, 'the provider mounts it').toContain(mount)

    // What is left after the declaration and the mount are removed: the loader's
    // own use of it. Asserted this way rather than by a literal `namespaces: X`
    // because two of these routes hand the constant to a shared card loader
    // instead of building the query options inline, and both spellings are the
    // same guarantee.
    const elsewhere = source
      .replace(
        new RegExp(
          `export const ${entry.constant} = \\[[\\s\\S]*?\\] as const;`,
        ),
        '',
      )
      .replace(mount, '')

    expect(elsewhere, 'the loader warms it').toContain(entry.constant)
  })

  it('always includes the global namespace', () => {
    // `RouteMessages` mounts its provider *over* the root's rather than adding
    // to it, so a set that omitted `core.global` would take the shell's strings
    // away from everything below it.
    expect(entry.namespaces).toContain('core.global')
  })
})

/**
 * The three routes whose set is not a route-local constant.
 *
 * Each has a reason: the shell's is shared with the header that reads it, the
 * settings subtree's is shared with the breadcrumb and four panels, and
 * password recovery's depends on which half of the flow the URL is in.
 */
describe('the shared namespace sets', () => {
  it('gives the header and the shell one list', () => {
    // The shell's loader warms `headerIntlQueryOptions`, which is built from
    // `HEADER_NAMESPACES`, which is what `Header` reads back. Both ends are
    // `@vitnode/core/tanstack/layout`'s, and the options are exported rather
    // than the list, so a loader that warmed a different set is not
    // expressible. What is asserted here is the app's half - that the shell
    // takes the options from the package instead of restating the namespaces.
    expect([...HEADER_NAMESPACES]).toEqual(['core.global', 'core.search'])
    // The shell's loader is `loadMainShell`, which warms
    // `headerIntlQueryOptions` - built from `HEADER_NAMESPACES`, which is what
    // `Header` reads back. Both ends are in one module, so a loader that warmed
    // a different set is not expressible.
    expect(readCore('layout/header.tsx')).toContain('headerIntlQueryOptions({')
    expect(read('routes/_main.tsx')).toContain('loadMainShell(context)')
  })

  it('gives the settings layout, its panels and its breadcrumb one list', () => {
    expect([...SETTINGS_NAMESPACES]).toEqual([
      'core.auth.settings',
      'core.global',
    ])

    expect(read('migration/settings-breadcrumb.tsx')).toContain(
      'SETTINGS_NAMESPACES',
    )
    expect(readCore('settings/layout.tsx')).toContain(
      '<RouteMessages namespaces={SETTINGS_NAMESPACES}>',
    )
  })

  it('gives password recovery a set per mode, from one function', () => {
    // The loader warms `passwordResetNamespaces(mode)` and returns it; the
    // component mounts what the loader returned, so the two cannot diverge.
    expect([...passwordResetNamespaces('request')]).toEqual([
      'core.global',
      'core.auth.sign_up',
      'core.auth.reset_password',
    ])
    expect([...passwordResetNamespaces('change')]).toEqual([
      'core.global',
      'core.auth.sign_up',
      'core.auth.reset_password',
      'core.auth.change_password',
    ])

    const source = readCore('auth/recovery-route.tsx')

    expect(source).toContain('const namespaces = passwordResetNamespaces(')
    expect(source).toContain('<RouteMessages namespaces={namespaces}>')
  })
})

/** Every namespace any migrated route mounts, de-duplicated. */
const ALL_NAMESPACES = [
  ...new Set([
    ...ROUTES.flatMap((entry) => [...entry.namespaces]),
    ...HEADER_NAMESPACES,
    ...SETTINGS_NAMESPACES,
    ...passwordResetNamespaces('change'),
  ]),
].sort((a, b) => a.localeCompare(b))

/**
 * The language switcher must not know any of this.
 *
 * Which sets are on screen is the cache's answer, not a list. A namespace
 * literal appearing in the locale layer means somebody hard-coded one, and the
 * next route to declare its own would silently stop being warmed on a switch.
 *
 * The layer is `@vitnode/core/tanstack/i18n` now, so the check reads the
 * package's source rather than this app's - and the rule got stronger in the
 * move: a package cannot name one of *this* app's route namespaces even by
 * accident, because it has never heard of them.
 */
describe('the locale layer names no route namespace', () => {
  const localeLayer = readFileSync(
    join(repoRoot, 'packages/vitnode/src/tanstack/i18n/switch-locale.ts'),
    'utf8',
  )

  it('keeps the switcher free of namespace literals', () => {
    for (const namespace of ALL_NAMESPACES.filter(
      (one) => one !== 'core.global',
    )) {
      expect(localeLayer, namespace).not.toContain(namespace)
    }
  })

  it('warms whatever the cache is holding instead', () => {
    // The positive half: without this the assertion above is satisfied by a
    // switcher that warms nothing at all.
    expect(localeLayer).toContain('loadedIntlNamespaces')
  })
})

/**
 * Polish coverage, at the granularity VitNode actually promises.
 *
 * Per *namespace*, not per key: an incomplete translation is a supported state
 * and falls back to English key by key. What is not supported is a namespace a
 * migrated route renders with no Polish in it at all - that is a screen that
 * looks untranslated, which is indistinguishable from a broken runtime.
 */
describe('every namespace a migrated route renders has Polish', () => {
  const translatedLeaves = (tree: unknown): number => {
    if (typeof tree === 'string') return 1
    if (typeof tree !== 'object' || tree === null) return 0

    return Object.values(tree).reduce<number>(
      (total, value) => total + translatedLeaves(value),
      0,
    )
  }

  const branch = (messages: unknown, namespace: string): unknown =>
    namespace
      .split('.')
      .reduce<unknown>(
        (node, key) => (node as Record<string, unknown> | undefined)?.[key],
        messages,
      )

  it.each(ALL_NAMESPACES)('%s', async (namespace) => {
    const { messages } = await loadIntlMessages({
      locale: 'pl',
      namespaces: [namespace],
    })
    const pl = JSON.parse(
      readFileSync(
        join(repoRoot, 'packages/vitnode/src/locales/pl.json'),
        'utf8',
      ),
    ) as unknown

    // The merged tree always has the branch - English sits underneath it. What
    // is being asserted is that the Polish file the package ships carries one
    // too, rather than the branch being English all the way down.
    expect(translatedLeaves(branch(messages, namespace))).toBeGreaterThan(0)
    expect(translatedLeaves(branch(pl, namespace))).toBeGreaterThan(0)
  })
})

/**
 * The two canaries from the regression report, in the one place the runtime
 * can be checked without a browser.
 *
 * `loadIntlMessages` is the whole server half of a route's messages: it is what
 * the loader's server function calls, and what `RouteMessages` reads back. If
 * these strings come out Polish here and the page renders English, the fault is
 * in the provider tree; if they come out English here, no provider could have
 * saved it.
 */
describe('the /discover and /search canaries resolve in Polish', () => {
  it.each([
    ['discoverTitle', 'Odkrywaj'],
    ['discoverDesc', 'Zobacz najnowszą aktywność w społeczności.'],
    ['loadMore', 'Wczytaj więcej'],
    ['title', 'Szukaj'],
    ['desc', 'Przeszukaj wszystko w społeczności.'],
    ['sortBy', 'Sortuj według'],
  ])('core.search.%s is "%s"', async (key, expected) => {
    const { messages } = await loadIntlMessages({
      locale: 'pl',
      namespaces: ['core.global', 'core.search'],
    })

    expect(messages).toHaveProperty(`core.search.${key}`, expected)
  })

  it('translates the header nav that sits above both of them', async () => {
    // `core.search.nav.*`, read by `Header` through `createTranslator` rather
    // than through a provider - the shell was the visible half of the report.
    const { messages } = await loadIntlMessages({
      locale: 'pl',
      namespaces: [...HEADER_NAMESPACES],
    })

    expect(messages).toHaveProperty('core.search.nav.discover', 'Odkrywaj')
    expect(messages).toHaveProperty('core.search.nav.search', 'Szukaj')
  })

  it('leaves English exactly as it was', async () => {
    // Adding a language may not reword the default one.
    const { messages } = await loadIntlMessages({
      locale: 'en',
      namespaces: ['core.global', 'core.search'],
    })

    expect(messages).toHaveProperty('core.search.discoverTitle', 'Discover')
    expect(messages).toHaveProperty(
      'core.search.discoverDesc',
      'See the latest activity across the community.',
    )
    expect(messages).toHaveProperty('core.global.login', 'Login')
  })
})
