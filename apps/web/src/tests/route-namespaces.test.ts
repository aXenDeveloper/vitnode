import { ADMIN_CRON_NAMESPACES } from '@vitnode/core/tanstack/admin/cron'
import { ADMIN_DASHBOARD_NAMESPACES } from '@vitnode/core/tanstack/admin/dashboard'
import { ADMIN_DEBUG_NAMESPACES } from '@vitnode/core/tanstack/admin/debug'
import { ADMIN_FILES_NAMESPACES } from '@vitnode/core/tanstack/admin/files'
import { ADMIN_INTEGRATIONS_NAMESPACES } from '@vitnode/core/tanstack/admin/integrations'
import { ADMIN_QUEUE_NAMESPACES } from '@vitnode/core/tanstack/admin/queue'
import { ADMIN_ROLES_NAMESPACES } from '@vitnode/core/tanstack/admin/roles'
import { ADMIN_SEARCH_INDEX_NAMESPACES } from '@vitnode/core/tanstack/admin/search-index'
import {
  ADMIN_STAFF_CREATE_NAMESPACES,
  ADMIN_STAFF_EDIT_NAMESPACES,
  ADMIN_STAFF_NAMESPACES,
} from '@vitnode/core/tanstack/admin/staff'
import {
  ADMIN_USER_NAMESPACES,
  ADMIN_USERS_NAMESPACES,
} from '@vitnode/core/tanstack/admin/users'
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
 * A namespace's loader module, paired with the screen it was split from.
 *
 * `route.tsx` holds the namespaces, the permission tuple and the loader - the
 * half a host's route file imports, and therefore the half that is eager in the
 * client entry. `screen.tsx` holds the component. See
 * `packages/vitnode/src/tanstack/eager-graph.test.ts`, which enforces the split
 * this derivation assumes.
 */
const screenModuleOf = (module: string): string =>
  module.replace(/([/-])route\.tsx$/, '$1screen.tsx')

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

  // ------------------------------------------------------- AdminCP Wave 1 ---
  // Every one of these mirrors the `<I18nProvider namespaces={...}>` its Next.js
  // page declares, plus `core.global` - which that provider adds itself and
  // `RouteMessages` does not, because it replaces the root's provider rather
  // than adding to it.
  {
    constant: 'ADMIN_DASHBOARD_NAMESPACES',
    declared: ADMIN_DASHBOARD_NAMESPACES,
    module: 'admin/dashboard/route.tsx',
    // `admin.global` is not the shell's copy leaking in: the widget resolver
    // files an uncategorised widget under `admin.global.nav.core`, and this
    // provider replaces the shell's, so the key has to be in *this* set.
    namespaces: ['admin.dashboard', 'admin.global', 'core.global'],
    route: '/admin/core',
  },
  {
    constant: 'ADMIN_INTEGRATIONS_NAMESPACES',
    declared: ADMIN_INTEGRATIONS_NAMESPACES,
    module: 'admin/integrations/route.tsx',
    namespaces: ['admin.system.integrations', 'core.global'],
    route: '/admin/core/system/integrations',
  },
  {
    constant: 'ADMIN_FILES_NAMESPACES',
    declared: ADMIN_FILES_NAMESPACES,
    module: 'admin/files/route.tsx',
    namespaces: ['admin.system.files', 'core.global'],
    route: '/admin/core/system/files',
  },
  {
    constant: 'ADMIN_SEARCH_INDEX_NAMESPACES',
    declared: ADMIN_SEARCH_INDEX_NAMESPACES,
    module: 'admin/search-index/route.tsx',
    // `core.search`, not an `admin.*` namespace: the search index's AdminCP copy
    // lives under `core.search.admin.*`, beside the public feed's, because the
    // collection labels and the result-type names are the same strings on both
    // surfaces. The Next.js page declares the identical set.
    namespaces: ['core.global', 'core.search'],
    route: '/admin/core/advanced/search',
  },
  {
    constant: 'ADMIN_CRON_NAMESPACES',
    declared: ADMIN_CRON_NAMESPACES,
    module: 'admin/cron/route.tsx',
    namespaces: ['admin.advanced.cron', 'core.global'],
    route: '/admin/core/advanced/cron',
  },
  {
    constant: 'ADMIN_QUEUE_NAMESPACES',
    declared: ADMIN_QUEUE_NAMESPACES,
    module: 'admin/queue/route.tsx',
    namespaces: ['admin.advanced.queue', 'core.global'],
    route: '/admin/core/advanced/queue',
  },
  {
    constant: 'ADMIN_DEBUG_NAMESPACES',
    declared: ADMIN_DEBUG_NAMESPACES,
    module: 'admin/debug/route.tsx',
    // `admin.advanced.queue` is there for one component: the queue snapshot
    // reuses `QueueStatusBadge` from the queue list, which reads
    // `admin.advanced.queue.status.*`. The Next.js page names the same pair.
    namespaces: ['admin.advanced.queue', 'admin.debug', 'core.global'],
    route: '/admin/core/debug',
  },

  // ------------------------------------------------------- AdminCP Wave 2 ---
  // Users, roles and staff. Same rule as Wave 1 - each mirrors the
  // `<I18nProvider namespaces={...}>` its Next.js page declares, plus
  // `core.global`.
  {
    constant: 'ADMIN_USERS_NAMESPACES',
    declared: ADMIN_USERS_NAMESPACES,
    module: 'admin/users/route.tsx',
    // `admin.global` is not the shell's copy leaking in: the `<h1>` and the
    // `<title>` are `admin.global.nav.users.list`, which is what the Next.js
    // page's heading reads too - and this provider replaces the shell's, so the
    // key has to be in *this* set.
    namespaces: ['admin.global', 'admin.user', 'core.global'],
    route: '/admin/core/users',
  },
  {
    constant: 'ADMIN_USER_NAMESPACES',
    declared: ADMIN_USER_NAMESPACES,
    module: 'admin/users/detail-route.tsx',
    // `core.search` is the timeline tab and the activity feed inside it - the
    // Next.js page declares the same pair, for the same component.
    namespaces: ['admin.user', 'core.global', 'core.search'],
    route: '/admin/core/users/$id',
  },
  {
    constant: 'ADMIN_ROLES_NAMESPACES',
    declared: ADMIN_ROLES_NAMESPACES,
    module: 'admin/roles/route.tsx',
    // `admin.global` for the same reason as the users list: the heading is
    // `admin.global.nav.users.roles`.
    namespaces: ['admin.global', 'admin.role', 'core.global'],
    route: '/admin/core/users/roles',
  },
  {
    constant: 'ADMIN_STAFF_NAMESPACES',
    declared: ADMIN_STAFF_NAMESPACES,
    module: 'admin/staff/route.tsx',
    namespaces: ['admin.staff', 'core.global'],
    route: '/admin/core/staff/{admins,moderators}',
  },
  {
    constant: 'ADMIN_STAFF_CREATE_NAMESPACES',
    declared: ADMIN_STAFF_CREATE_NAMESPACES,
    module: 'admin/staff/create-route.tsx',
    namespaces: ['admin.staff', 'core.global'],
    route: '/admin/core/staff/{admins,moderators}/create',
  },
  {
    constant: 'ADMIN_STAFF_EDIT_NAMESPACES',
    declared: ADMIN_STAFF_EDIT_NAMESPACES,
    module: 'admin/staff/edit-route.tsx',
    // Deliberately *not* the permission labels. Those are flat top-level message
    // keys - `"@vitnode/core:users:can_view"` - one per permission, so a real
    // catalog is forty-odd of them and the i18n runtime refuses more than
    // `MAX_NAMESPACES` per request. `loadStaffPermissionLabels` fetches them as
    // data instead, in chunks the runtime accepts, and hands the result to the
    // pure model as a lookup. See `admin/staff/edit-route.tsx`.
    namespaces: ['admin.staff', 'core.global'],
    route: '/admin/core/staff/{admins,moderators}/edit/$id',
  },
] as const

describe.each(ROUTES)('$route declares one namespace set', (entry) => {
  it('declares the set this audit expects', () => {
    expect([...entry.declared]).toEqual([...entry.namespaces])
  })

  it('warms it in the loader and mounts the same constant', () => {
    // The same identifier in both places, not two lists that happen to match:
    // the namespace list is part of the query key, so a loader that warmed a
    // different set warmed a key nobody reads.
    //
    // Stage 14 put the two halves in two modules, and the constant is now the
    // seam between them. A route file's `loader` is evaluated in the client
    // entry - TanStack Start splits out `component` and leaves everything else
    // behind - so a namespace module that also held its screen put that screen
    // on every page of the application. `route.tsx` declares the constant and
    // warms it; `screen.tsx` imports it back and mounts it. Reading the pair is
    // what keeps this audit honest across that split.
    const loader = readCore(entry.module)
    const screen = readCore(screenModuleOf(entry.module))
    const mount = `<RouteMessages namespaces={${entry.constant}}>`

    expect(screen, 'the provider mounts it').toContain(mount)

    // What is left after the declaration is removed: the loader's own use of it.
    // Asserted this way rather than by a literal `namespaces: X` because two of
    // these routes hand the constant to a shared card loader instead of building
    // the query options inline, and both spellings are the same guarantee.
    const elsewhere = loader.replace(
      new RegExp(`export const ${entry.constant} = \\[[\\s\\S]*?\\] as const;`),
      '',
    )

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

    // The crumb moved into the module that declares the settings routes when
    // they became `@vitnode/core`'s - `withCoreMainRoutes` - so it is read from
    // there rather than from a binding in this application.
    expect(readCore('routes/main/settings.tsx')).toContain(
      '<RouteMessages namespaces={SETTINGS_NAMESPACES}>',
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

    expect(readCore('auth/recovery-route.tsx')).toContain(
      'const namespaces = passwordResetNamespaces(',
    )
    expect(readCore('auth/recovery-screen.tsx')).toContain(
      '<RouteMessages namespaces={namespaces}>',
    )
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
