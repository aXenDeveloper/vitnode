import type { ResolvedPluginRouteModule } from '@vitnode/core/framework/plugin-routes'
import type { PluginRouteDefinition } from '@vitnode/core/routing'
import type { Plugin } from 'vite'

import {
  generatePluginRouteManifestSource,
  generatePluginRouteRegistrySource,
  pluginIdsFromLoadedConfig,
  resolvePluginRouteModules,
  routeDeclarationsFromManifest,
} from '@vitnode/core/framework/plugin-routes'
import { buildPluginRouteManifest } from '@vitnode/core/routing'
import { createJiti } from 'jiti'
import { existsSync, statSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const APP_ROOT = import.meta.dirname

/** The configured plugin list, and the only place it is read from. */
const CONFIG_PATH = join(APP_ROOT, 'src', 'vitnode.config.ts')

/**
 * The two generated files. Both committed, and both rewritten only when they
 * change.
 *
 * Split because they answer different questions and are read by different
 * things. The manifest says *what* routes exist and at which canonical VitNode
 * path - framework-neutral data, which is what makes it worth generating once
 * and reading from any router. The registry says *how* each route's module is
 * imported, as one literal `import()` per route. `src/lib/plugin-routes.ts`
 * joins them by route id and is the only place that knows about TanStack.
 */
const MANIFEST_OUTPUT_PATH = join(
  APP_ROOT,
  'src',
  'plugin-route-manifest.gen.ts',
)
const REGISTRY_OUTPUT_PATH = join(APP_ROOT, 'src', 'plugin-routes.gen.ts')

/**
 * Where a plugin declares its routes, as a package export subpath.
 *
 * A plugin that does not export it - `@vitnode/blog` today - simply contributes
 * no routes. That is not an error: most plugins are AdminCP content types and
 * ship no pages at all, and a missing manifest has to mean "none" rather than
 * failing the build of every app that installs one.
 */
const MANIFEST_SUBPATH = 'routes/manifest'

const ERROR_PREFIX = '[VitNode plugin routes]'

/**
 * Resolution as this app would do it, honouring each package's `exports`.
 *
 * `createRequire` rather than `import.meta.resolve`, and the difference matters:
 * every VitNode plugin maps `"./*"` to `"./dist/src/*.js"`, and
 * `import.meta.resolve` answers a *pattern* match without ever touching the
 * disk - it happily returns a URL for `@vitnode/example/routes/nope`. The CJS
 * resolver stats the file, so a wrong entry is caught here instead of becoming a
 * 404 in a browser. `existsSync` is checked anyway, because being wrong about
 * this is the failure mode this whole step exists to prevent.
 */
const requireFromApp = createRequire(join(APP_ROOT, 'package.json'))

const resolvePackageFile = (specifier: string): null | string => {
  try {
    const file = requireFromApp.resolve(specifier)

    return existsSync(file) ? file : null
  } catch {
    return null
  }
}

/**
 * The plugins this app is configured with, in configuration order.
 *
 * `jiti` because `vitnode.config.ts` is TypeScript that imports other TypeScript
 * without extensions, which Node's own type stripping will not load. It is the
 * same loader `vitnode`'s own CLI scripts use to read this file.
 *
 * A plugin that is installed but not listed here is not consulted, and nothing
 * ever enumerates `node_modules` - so disabling a plugin removes its routes from
 * the bundle by construction rather than by a filter somebody has to remember.
 */
const readConfiguredPluginIds = async (): Promise<string[]> => {
  const jiti = createJiti(import.meta.url, { interopDefault: true })

  return pluginIdsFromLoadedConfig(
    await jiti.import(CONFIG_PATH),
    relative(APP_ROOT, CONFIG_PATH),
  )
}

/**
 * One plugin's route declarations, loaded from its compiled manifest.
 *
 * The manifest is plain data by contract, so this is a normal `import()` of the
 * plugin's build output in Node - no React, no router and no app code is
 * evaluated to find out which routes exist.
 *
 * Loaded once and read twice, by the two layers that each own their own half of
 * what a route is. `routeDeclarationsFromManifest` takes the `{ id, entry }` the
 * registry generator needs and rejects anything else; `definitions` is the same
 * array handed on untouched for `buildPluginRouteManifest`, which validates
 * every field it reads - the path, the area, the entry, the ids - and is the
 * only thing that decides whether a route is legal. Two readers rather than one
 * shared narrowed shape, so neither layer has to know what the other requires.
 *
 * ## Why the URL carries an mtime
 *
 * Node's ESM loader caches modules by URL, permanently and with no eviction. The
 * dev server therefore had a watcher that worked and a regeneration that could
 * not: edit a plugin's manifest, the watcher fires, `regenerate()` runs, and
 * `import()` of the same URL hands back the module Node parsed minutes ago - so
 * the generated files were rewritten from stale declarations, or more often not
 * rewritten at all because the bytes had not changed.
 *
 * A version taken off the file itself is the smallest thing that fixes it and
 * keeps every property that matters: it changes when the file changes, so an
 * untouched manifest keeps its cache entry across regenerations rather than
 * leaking a new one, and it is read off disk rather than invented, so two builds
 * of the same tree ask for the same URL. It never reaches the generated output -
 * only `id`, `entry`, `path` and `area` are read from what comes back - so the
 * generated bytes stay a function of the declarations alone, and the browser
 * never sees any of this.
 *
 * Size as well as mtime, because mtime alone is only as fine-grained as the
 * filesystem underneath: APFS and ext4 report sub-millisecond, but a Docker
 * bind mount can round to the second, and two rebuilds inside one second is an
 * ordinary thing for a watcher to cause. Two versions of a route manifest that
 * share a timestamp *and* a byte length would still collide; that is a much
 * narrower hole than the one this closes, and shutting it completely would mean
 * hashing the file on every pass.
 */
const readPluginRoutes = async (pluginId: string) => {
  const specifier = `${pluginId}/${MANIFEST_SUBPATH}`
  const file = resolvePackageFile(specifier)

  if (file === null) return { declarations: [], definitions: [], watch: null }

  const { mtimeMs, size } = statSync(file)
  const url = pathToFileURL(file)
  url.searchParams.set('v', `${size}-${mtimeMs}`)

  const loaded = await import(url.href)
  const declarations = routeDeclarationsFromManifest(loaded, specifier)

  return {
    declarations,
    // Safe by the line above: it threw unless `routes` is an array of records
    // with a string `id` and `entry`. Everything past that - and there is no
    // `path` in a declaration - is `buildPluginRouteManifest`'s to check, which
    // it does defensively, from `unknown`.
    definitions: (loaded as { routes: PluginRouteDefinition[] }).routes,
    watch: file,
  }
}

/**
 * Fails the build for a route module the app cannot import.
 *
 * The alternative is a generated `import()` of a specifier that does not
 * resolve, which Vite reports from inside the module graph long after anyone can
 * tell which plugin caused it - or worse, in the browser.
 */
const assertImportable = (module: ResolvedPluginRouteModule): void => {
  if (resolvePackageFile(module.specifier) !== null) return

  throw new Error(
    `${ERROR_PREFIX} "${module.key}" declares the entry "${module.entry}", which cannot be imported as "${module.specifier}". Check that ${module.pluginId} exports "./${module.entry}" and that its build output is up to date.`,
  )
}

/**
 * Everything the generated files are built from, discovered at build time only.
 *
 * `Promise.all` over the configured ids keeps the result independent of which
 * manifest happens to load first, and both generators sort on top of that - so
 * the bytes depend on the configuration and nothing else.
 *
 * This is also where a plugin route stops being able to fail quietly, and the
 * order matters. `resolvePluginRouteModules` rejects an id or an entry that
 * cannot be written into an import; `assertImportable` rejects an entry that
 * does not resolve to a real file; `buildPluginRouteManifest` rejects a path it
 * cannot parse and - the one no other layer can see - **two configured plugins
 * claiming the same URL**, naming both sides. All three throw out of Vite's
 * `config` hook, so `vite dev` and `vite build` stop rather than starting an app
 * whose route table depends on which plugin was registered first.
 */
const discover = async () => {
  const pluginIds = await readConfiguredPluginIds()
  const loaded = await Promise.all(
    pluginIds.map(async (pluginId) => ({
      pluginId,
      ...(await readPluginRoutes(pluginId)),
    })),
  )

  const modules = resolvePluginRouteModules(
    loaded.map(({ declarations, pluginId }) => ({
      pluginId,
      routes: declarations,
    })),
  )
  modules.forEach(assertImportable)

  const manifest = buildPluginRouteManifest(
    loaded.map(({ definitions, pluginId }) => ({
      pluginId,
      routes: definitions,
    })),
  )

  return {
    manifest: generatePluginRouteManifestSource(manifest),
    registry: generatePluginRouteRegistrySource(modules),
    watch: loaded.flatMap(({ watch }) => watch ?? []),
  }
}

/**
 * Writes a generated file, and only if it changed.
 *
 * The write-if-changed is load bearing, not an optimisation: these files live in
 * `src/`, so rewriting identical bytes on every dev-server event would trip
 * Vite's watcher and reload the page in a loop - the same trap two route
 * generators writing `routeTree.gen.ts` fall into.
 */
const writeIfChanged = async (path: string, source: string): Promise<void> => {
  const current = existsSync(path) ? await readFile(path, 'utf8') : null

  if (current !== source) await writeFile(path, source, 'utf8')
}

/** Both generated files, from one discovery pass. */
const writeGenerated = async (): Promise<string[]> => {
  const { manifest, registry, watch } = await discover()

  await Promise.all([
    writeIfChanged(MANIFEST_OUTPUT_PATH, manifest),
    writeIfChanged(REGISTRY_OUTPUT_PATH, registry),
  ])

  return watch
}

/**
 * Build-time discovery of the route modules this app's plugins ship.
 *
 * The boundary this plugin exists to draw:
 *
 * - **Here, at build time.** Read the configured plugins, load their route
 *   manifests from `node_modules`, check every entry resolves to a real file,
 *   validate every route and reject two plugins claiming one URL, then write
 *   `src/plugin-route-manifest.gen.ts` and `src/plugin-routes.gen.ts`.
 * - **In the browser.** Import those two files. They contain literal data and
 *   literal `import()` calls and nothing else - no `node:fs`, no package
 *   resolution, no validation to repeat and no specifier built from a variable,
 *   and so nothing a bundler cannot follow.
 *
 * Nothing is copied. The plugin's page stays in the plugin, compiled in its own
 * `dist`, and the app holds one generated line of registration per route.
 */
export const vitNodePluginRoutes = (): Plugin => ({
  config: async () => {
    await writeGenerated()
  },
  /**
   * Regenerates while the dev server runs, so editing a plugin's manifest is
   * enough. Adding or removing a plugin in `vitnode.config.ts` is picked up too;
   * a manifest that did not exist when the server started is not, because there
   * is no file to watch yet - restart for that, exactly as installing a plugin
   * already requires.
   */
  configureServer: (server) => {
    let watched = new Set<string>()

    /**
     * The tail of the regeneration chain.
     *
     * Regeneration is asynchronous - it resolves several manifests and writes two
     * files - and the watcher can fire twice before the first pass finishes. Run
     * concurrently, two passes interleave and the *older* one can perform the last
     * write, leaving generated files that describe a manifest that no longer
     * exists until something else happens to touch it.
     *
     * Chaining rather than a queue: each pass waits for the previous one, so the
     * last event to arrive is the last to write. A pass re-reads everything from
     * disk when it starts, so a run queued behind three others simply sees the
     * final state - no coalescing needed, and nothing to keep in sync.
     */
    let chain: Promise<void> = Promise.resolve()

    const regenerate = (): void => {
      chain = chain.then(async () => {
        try {
          watched = new Set(await writeGenerated())
          server.watcher.add([...watched])
        } catch (error) {
          server.config.logger.error(String(error))
        }
      })
    }

    const onChange = (file: string) => {
      if (file !== CONFIG_PATH && !watched.has(file)) return

      regenerate()
    }

    server.watcher.add(CONFIG_PATH)
    regenerate()
    server.watcher.on('change', onChange)
    server.watcher.on('unlink', onChange)
  },
  name: 'vitnode:plugin-routes',
})
