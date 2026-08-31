import { hostRoutePathsFromFiles } from '@vitnode/core/framework/plugin-routes'
import {
  routeMatchKey,
  routeMatchKeyFromTanStackPath,
} from '@vitnode/core/routing'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { pluginRouteManifest } from '#/plugin-route-manifest.gen'
import { pluginRouteModules } from '#/plugin-routes.gen'

/**
 * A plugin's page has exactly one home, and this is the file that keeps it that
 * way.
 *
 * Static and pure: a listing of this app's own route files, the committed
 * generated manifest, and `hostRoutePathsFromFiles` - the same pure function the
 * build-time collision check reads host URLs with. Nothing here builds a router,
 * renders a component, starts Vite or calls an API.
 *
 * ## The architecture being pinned
 *
 *     plugin route manifest            plugins/example/src/routes/manifest.ts
 *              ↓  read at build time by @vitnode/core/framework/vite
 *     generated registries             src/plugin-route-manifest.gen.ts
 *                                      src/plugin-routes.gen.ts
 *              ↓  joined by route id in src/router.tsx
 *     withPluginRoutes(...)            one route tree, composed at module scope
 *
 * There is no step between those in which a page becomes a file in this
 * application, and that absence is the whole claim. `src/routes/**` is this
 * app's *own* pages; a plugin's are imported out of the plugin's `dist` by a
 * generated literal `import()`.
 *
 * ## Why a test rather than a convention
 *
 * VitNode has had this wrong twice in two different frameworks, and both times
 * the symptom was silence rather than an error.
 *
 * Under Next.js a plugin's `src/routes/{main,admin,blank,breadcrumb}/` was
 * *copied* into the host's App Router on every save. Two copies of one page then
 * existed, the copy was the one that ran, and editing the original appeared to
 * do nothing until the watcher happened to fire. `@vitnode/core`'s own
 * `scripts/no-route-copier.test.ts` is what keeps that engine deleted.
 *
 * The failure this file guards is the same mistake spelled in TanStack: a
 * generator, or a hand, adding `src/routes/_main/example.tsx` beside a manifest
 * that already declares `/example`. Nothing would break loudly. The router would
 * hold two routes matching one URL and rank them, so which page a visitor got
 * would depend on the tree's shape - exactly the "whichever loaded first wins"
 * outcome the manifest layer exists to make impossible.
 *
 * `plugin-routes.test.ts` beside this one asserts the positive half: the plugin's
 * pages really are in the route tree, in the right shells, with their parameters
 * parsed. Together they say the routes work *and* that no host file is what makes
 * them work.
 */

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../..')
const routesDir = join(appRoot, 'src', 'routes')

/** Every file under this app's routes directory, relative to it. */
const routeFiles = ((): string[] => {
  const walk = (current: string, prefix: string): string[] =>
    readdirSync(current, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .flatMap((entry) => {
        if (entry.name.startsWith('.')) return []

        const nested = prefix === '' ? entry.name : `${prefix}/${entry.name}`

        return entry.isDirectory()
          ? walk(join(current, entry.name), nested)
          : [nested]
      })

  return walk(routesDir, '')
})()

/**
 * Every URL this app's own route files claim, read with core's own reader.
 *
 * Deliberately not a second implementation. If this test computed host paths its
 * own way it could disagree with the build about what a collision is, and the
 * disagreement would be invisible: a duplicate this file called fine would fail
 * a build, or - far worse - one the build called fine would pass here.
 */
const hostRoutes = hostRoutePathsFromFiles(routeFiles)
const hostKeys = new Map(
  hostRoutes.map((hostRoute) => [
    routeMatchKeyFromTanStackPath(hostRoute.path),
    hostRoute,
  ]),
)

/** The packages this app installs as plugins, as their import specifiers. */
const pluginIds = [
  ...new Set(pluginRouteManifest.map((route) => route.pluginId)),
]

const sourceOf = (file: string): string =>
  readFileSync(join(routesDir, file), 'utf8')

describe('the route files this application owns', () => {
  /**
   * Guards the guards. Every assertion below is an "is absent" claim over one of
   * these two lists, and an empty list makes all of them vacuously true - which
   * is precisely how a regression test stops noticing a regression.
   */
  it('is a populated listing, and so is the plugin manifest', () => {
    expect(existsSync(routesDir)).toBe(true)
    expect(statSync(routesDir).isDirectory()).toBe(true)
    // A floor, not a count. Twenty-nine files left this directory when core's own
    // screens became code-based routes - the AdminCP's sixteen, the public nine,
    // and the four shell-less auth ones - so what is left is this application's
    // front page, its shells, its documentation and its API mount.
    expect(routeFiles.length).toBeGreaterThan(5)
    expect(hostRoutes.length).toBeGreaterThan(2)
    expect(pluginRouteManifest.length).toBeGreaterThan(0)
    expect(pluginIds.length).toBeGreaterThan(0)
  })

  /**
   * D. The application's own pages are still application pages.
   *
   * The cheap way to pass every other test in this file is to delete
   * `src/routes` - so the shape of the tree is asserted first, by URL rather
   * than by filename, through the same reader. These are the routes Stages 4
   * through 16 migrated; a plugin may not claim any of them, and neither may a
   * cleanup.
   *
   * Three, and that is the point. Everything else - `/discover`, `/search`,
   * `/files`, the settings subtree, every AdminCP screen, the auth cards and the
   * AdminCP's own sign-in - is `@vitnode/core`'s, mounted by
   * `withCoreMainRoutes`, `withCoreAdminRoutes` and `withCoreRootRoutes` rather
   * than written as files here. A *file* for any of them would be the
   * duplication this whole file exists to forbid, one package up from a plugin.
   *
   * What is left is what the application itself owns: its front page, the
   * dashboard anchor `_admin` needs in order to exist, and its documentation.
   */
  it.each(['/', '/admin/core', '/docs'])(
    'claims %s with a route file of its own',
    (path) => {
      expect(hostKeys.get(routeMatchKeyFromTanStackPath(path))).toBeDefined()
    },
  )
})

describe('a plugin page is never a file in this application', () => {
  /**
   * A. The regression itself, stated over every route the installed plugins
   * declare rather than over a list written here.
   *
   * Compared by **match key**, not by text, because that is what a router
   * compares: `/example/guide/:topic` and a host `_main/example/guide/$topic.tsx`
   * are different strings and the same URL. Reusing core's key space is what
   * makes this test agree with the build about what "the same route" means -
   * `/users/new` and `/users/:id` are correctly *not* a duplicate.
   */
  it.each(
    // The whole route, not its id: looking it back up would need a non-null
    // assertion for a lookup that cannot fail.
    pluginRouteManifest.map((route) => ({
      id: route.id,
      path: route.path,
      route,
    })),
  )('has no host route file claiming $path ($id)', ({ route }) => {
    const duplicate = hostKeys.get(routeMatchKey(route.segments))

    expect(
      duplicate,
      duplicate === undefined
        ? ''
        : `${route.id} is declared in a plugin manifest and also materialised as ${duplicate.file}. A plugin page must have exactly one home.`,
    ).toBeUndefined()
  })

  /**
   * B. And it is still mounted - which is the half that makes the deletion above
   * a fix rather than a removal.
   *
   * Both generated files, in both directions: a route in the manifest has a
   * literal import in the registry, and the registry holds nothing the manifest
   * does not declare. `assertPluginRouteRegistryParity` says this at build time;
   * saying it again over the committed bytes is what catches a generated file
   * edited by hand or left behind by a failed pass.
   */
  it('declares every plugin route in both generated registries', () => {
    const declared = pluginRouteManifest.map((route) => route.id).sort()

    expect(Object.keys(pluginRouteModules).sort()).toEqual(declared)
    for (const key of declared) {
      expect(
        pluginRouteModules[key as keyof typeof pluginRouteModules],
      ).toBeTypeOf('function')
    }
  })

  /**
   * E. The AdminCP is the same rule, and worth naming separately because it is
   * the one an author is most likely to think needs a host file: an admin page
   * lives behind a session guard, a sidebar and a breadcrumb that all belong to
   * this app, so "surely *that* one has to be mounted here" is a reasonable
   * wrong guess.
   *
   * It does not. `area: "admin"` picks the shell a plugin route is composed
   * under, and `src/routes/_admin/` stays this application's own screens.
   */
  it('materialises no admin plugin page under the AdminCP route directory', () => {
    const adminPluginRoutes = pluginRouteManifest.filter(
      (route) => route.area === 'admin',
    )

    // The example plugin ships one, so this is not a vacuous filter.
    expect(adminPluginRoutes.length).toBeGreaterThan(0)

    const materialised = adminPluginRoutes.flatMap((route) => {
      const duplicate = hostKeys.get(routeMatchKey(route.segments))

      return duplicate === undefined ? [] : [`${route.id} -> ${duplicate.file}`]
    })

    expect(materialised).toEqual([])
  })

  /**
   * A proxy is still a copy.
   *
   * `export { ExamplePage } from '@vitnode/example/routes/example-page'` in a
   * route file would pass every assertion above - it claims no duplicate URL,
   * because it *is* the URL - and would reintroduce exactly what was deleted: a
   * host file that has to be written, and kept in step, for a plugin's page to
   * exist. The plugin's own module is reached through the generated registry and
   * nowhere else, so no route file in this app has any reason to name a plugin
   * package.
   */
  it('imports no plugin package from any route file', () => {
    const offenders = routeFiles
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
      .flatMap((file) => {
        const code = sourceOf(file)

        return pluginIds
          .filter((pluginId) =>
            new RegExp(
              `(?:from|import)\\s*\\(?\\s*['"]${pluginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"]*)?['"]`,
            ).test(code),
          )
          .map((pluginId) => `${file} imports ${pluginId}`)
      })

    expect(offenders).toEqual([])
  })

  /**
   * Nothing generated lives in the routes directory.
   *
   * The generated files are four `*.gen.ts` at the top of `src/`, and none of
   * them is a page. A `.gen.tsx` appearing under `src/routes/` is the signature
   * of a materialising generator whatever it is called, so the shape is asserted
   * rather than any particular tool's name.
   */
  it('holds no generated file under the routes directory', () => {
    expect(routeFiles.filter((file) => file.includes('.gen.'))).toEqual([])
  })

  /**
   * And the plugin's own route modules are where they belong: inside the
   * plugin's package, reached by a package export subpath.
   *
   * A specifier that had become relative (`./routes/...`) or app-internal
   * (`#/routes/...`) would mean the module had been moved into this app - the
   * copy, arrived by a different route. Asserted on the committed manifest's
   * entries, which is what the generated `import()` calls are built from.
   */
  it('imports every plugin route module from the plugin package', () => {
    for (const route of pluginRouteManifest) {
      expect(route.entry).not.toMatch(/^[.#/]/)
      expect(route.pluginId).not.toBe('')
    }
  })
})

describe('the deleted route copiers', () => {
  /**
   * Both of them, from this application's side.
   *
   * `@vitnode/core` guards its own half - the Next.js copier in
   * `scripts/no-route-copier.test.ts`, the build-time strangler in the same
   * file. What only this app can say is that *its* tree carries no residue: no
   * App Router topology, and no directory of pages waiting to be copied
   * anywhere.
   */
  it('has no App Router topology left in the routes directory', () => {
    expect(
      routeFiles.filter(
        (file) =>
          file.includes('[locale]') ||
          file.includes('@breadcrumb') ||
          /(^|\/)(page|layout)\.tsx$/.test(file),
      ),
    ).toEqual([])
  })

  /**
   * The four directory names a plugin's pages used to be copied out of. A
   * `main/`, `admin/`, `blank/` or `breadcrumb/` directory inside a plugin's
   * `routes/` is the old convention, whoever writes it and whatever reads it.
   */
  it.each(pluginIds)('finds no legacy route directory in %s', (pluginId) => {
    const pluginRoutesDir = join(
      appRoot,
      'node_modules',
      pluginId,
      'dist/src/routes',
    )

    if (!existsSync(pluginRoutesDir)) return

    expect(
      readdirSync(pluginRoutesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) =>
          ['admin', 'blank', 'breadcrumb', 'main'].includes(name),
        ),
    ).toEqual([])
  })

  /**
   * The router composes the plugin routes; it does not list them.
   *
   * A hand-written route path, or an import of a plugin's page module, in
   * `src/router.tsx` would be the copy relocated into the one file that is
   * allowed to know plugins exist at all. What it may name is the two generated
   * registries and the two shells they mount under.
   */
  it('mounts plugin routes from the generated registries alone', () => {
    const router = readFileSync(join(appRoot, 'src/router.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    expect(router).toContain('withPluginRoutes')
    expect(router).toContain('./plugin-route-manifest.gen')
    expect(router).toContain('./plugin-routes.gen')

    for (const pluginId of pluginIds) {
      expect(router).not.toContain(pluginId)
    }
  })

  it('resolves the routes directory relative to this app, not a copy', () => {
    expect(relative(appRoot, routesDir)).toBe(join('src', 'routes'))
  })
})
