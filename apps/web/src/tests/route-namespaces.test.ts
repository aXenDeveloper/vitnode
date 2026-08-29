import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { HEADER_NAMESPACES } from '#/components/header'
import { passwordResetNamespaces } from '#/lib/auth/password-reset-route'
import { SETTINGS_NAMESPACES } from '#/lib/settings/panel'
import { loadIntlMessages } from '#/server/messages.server'

const appSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path: string) => readFileSync(join(appSrc, path), 'utf8')

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
 * than imported so that changing a route's set has to be a deliberate edit
 * here too.
 */

/** Every namespace set a migrated route declares, spelled out. */
const ROUTES = [
  {
    constant: 'DISCOVER_NAMESPACES',
    file: 'routes/_main/discover.tsx',
    namespaces: ['core.global', 'core.search'],
    route: '/discover',
  },
  {
    constant: 'SEARCH_NAMESPACES',
    file: 'routes/_main/search.tsx',
    namespaces: ['core.global', 'core.search'],
    route: '/search',
  },
  {
    constant: 'LOGIN_NAMESPACES',
    file: 'routes/login.tsx',
    namespaces: ['core.global', 'core.auth.sign_in', 'core.auth.sso'],
    route: '/login',
  },
  {
    constant: 'REGISTER_NAMESPACES',
    file: 'routes/register.tsx',
    namespaces: ['core.global', 'core.auth.sign_up', 'core.auth.sso'],
    route: '/register',
  },
  {
    constant: 'CALLBACK_NAMESPACES',
    file: 'routes/login_.sso.$providerId.tsx',
    namespaces: ['core.global', 'core.auth.sso'],
    route: '/login/sso/$providerId',
  },
  {
    constant: 'FILES_NAMESPACES',
    file: 'routes/_main/_authenticated/files.tsx',
    namespaces: ['core.files', 'core.global'],
    route: '/files',
  },
] as const

/**
 * `const NAME = [...] as const`, read back out of the source.
 *
 * These are route-local by design - a route's namespaces are nobody else's
 * business - so there is nothing to import. Parsing them is what lets this test
 * compare the declared set against the table above without exporting a constant
 * purely so a test can see it.
 */
const declaredNamespaces = (source: string, constant: string): string[] => {
  const match = new RegExp(
    `const ${constant} = \\[([\\s\\S]*?)\\] as const`,
  ).exec(source)

  expect(
    match,
    `${constant} is declared as an \`as const\` array`,
  ).not.toBeNull()

  return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    ([, value]) => value,
  )
}

describe.each(ROUTES)('$route declares one namespace set', (entry) => {
  const source = read(entry.file)

  it('declares the set this audit expects', () => {
    expect(declaredNamespaces(source, entry.constant)).toEqual([
      ...entry.namespaces,
    ])
  })

  it('warms it in the loader and mounts the same constant', () => {
    // The same identifier in both places, not two lists that happen to match:
    // the namespace list is part of the query key, so a loader that warmed a
    // different set warmed a key nobody reads.
    expect(source).toContain(`namespaces: ${entry.constant},`)
    expect(source).toContain(`<RouteMessages namespaces={${entry.constant}}>`)
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
    // `HEADER_NAMESPACES`, which is what `Header` reads back. One export, so a
    // loader that warmed a different set is not expressible.
    expect([...HEADER_NAMESPACES]).toEqual(['core.global', 'core.search'])
    expect(read('routes/_main.tsx')).toContain('headerIntlQueryOptions({')
    expect(read('components/header.tsx')).toContain(
      'useSuspenseQuery(headerIntlQueryOptions({ locale }))',
    )
  })

  it('gives the settings layout, its panels and its breadcrumb one list', () => {
    expect([...SETTINGS_NAMESPACES]).toEqual([
      'core.auth.settings',
      'core.global',
    ])

    for (const file of [
      'routes/_main/_authenticated/settings.tsx',
      'components/layout/settings-breadcrumb.tsx',
    ]) {
      expect(read(file), file).toContain('SETTINGS_NAMESPACES')
    }
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

    const source = read('routes/login_.reset-password.tsx')

    expect(source).toContain('const namespaces = passwordResetNamespaces(')
    expect(source).toContain('<RouteMessages namespaces={namespaces}>')
  })
})

/** Every namespace any migrated route mounts, de-duplicated. */
const ALL_NAMESPACES = [
  ...new Set([
    ...ROUTES.flatMap((entry) => entry.namespaces),
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
 */
describe('the locale layer names no route namespace', () => {
  it('keeps the switcher free of namespace literals', () => {
    const client = read('lib/i18n/client.ts')

    for (const namespace of ALL_NAMESPACES.filter(
      (one) => one !== 'core.global',
    )) {
      expect(client, namespace).not.toContain(namespace)
    }
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
      readFileSync(join(appSrc, 'locales/@vitnode/core/pl.json'), 'utf8'),
    ) as unknown

    // The merged tree always has the branch - English sits underneath it. What
    // is being asserted is that the *override* carries one too.
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
