import {
  vitNodeGeneratedRegistries,
  vitNodeGeneratedRegistryPaths,
} from '@vitnode/core/framework/vite'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { withoutComments } from './source'

/**
 * This application's generated registries, held to the two things a generated
 * file has to be: **fresh** and **reproducible**.
 *
 * Everything here runs the real generator over the real workspace - the plugins
 * in `src/vitnode.config.ts`, resolved out of `node_modules` exactly as a build
 * would resolve them. `@vitnode/core`'s own tests state the pure half against
 * fixtures: `framework/plugin-routes/compile.test.ts` for what a compilation
 * produces, `framework/vite/projections.test.ts` for the four projections being
 * one list. Neither of them can say anything about *this* app's committed bytes,
 * which is the whole subject of this file.
 *
 * ## Fresh
 *
 * All four files are committed, and a committed generated file can be stale in a
 * way nothing else notices: the plugin's manifest changes, the author never runs
 * `vite dev`, and the diff carries a registry that describes the manifest as it
 * was. A build regenerates them, so the *application* is right - but the
 * repository is wrong, code review reads a lie, and a typecheck run against the
 * committed tree disagrees with the one run after a build.
 *
 * So the generator is asked what should be in each file and the answer is
 * compared with what is there. Failing means "run `pnpm dev` or `pnpm build` and
 * commit the result", which is what the message says.
 *
 * ## Reproducible
 *
 * Two passes over an unchanged tree, byte-compared. That is the property every
 * generator in this layer is written for - sorted input, sorted output, no clock,
 * no filesystem order, no machine collation - and the one it is worth checking
 * end to end rather than per function, because it only takes one unsorted
 * `readdir` anywhere in the pass to lose it.
 *
 * ## Read-only, which is why this test can exist at all
 *
 * `vitNodeGeneratedRegistries` returns bytes; `vitNodePluginRoutes` is the only
 * thing that writes them. A test that had to run the writer to learn what the
 * generator produces would rewrite four files in `src/` as a side effect of
 * `vitest run`, and could not tell a stale committed file from one it had just
 * fixed. The modification times are asserted below to keep that split honest.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../..')

/** The four names the generator projects, and what each one answers. */
const REGISTRIES = {
  adminNav: 'src/admin-nav.gen.ts',
  contentRegistry: 'src/content-registry.gen.ts',
  manifest: 'src/plugin-route-manifest.gen.ts',
  registry: 'src/plugin-routes.gen.ts',
} as const

const asRelative = (path: string): string =>
  relative(appRoot, path).replaceAll(sep, '/')

const committed = (path: string): string => readFileSync(path, 'utf8')

const mtimesOf = (): Record<string, number> =>
  Object.fromEntries(
    Object.values(REGISTRIES).map((file) => [
      file,
      statSync(join(appRoot, file)).mtimeMs,
    ]),
  )

let first: Awaited<ReturnType<typeof vitNodeGeneratedRegistries>>
let second: typeof first
let mtimesBefore: Record<string, number>
let mtimesAfter: Record<string, number>

beforeAll(async () => {
  mtimesBefore = mtimesOf()
  first = await vitNodeGeneratedRegistries({ appRoot })
  second = await vitNodeGeneratedRegistries({ appRoot })
  mtimesAfter = mtimesOf()
})

describe('what the generation pass produces', () => {
  it('projects exactly the four registries, and nothing else', () => {
    expect(first.map((file) => file.name).sort()).toEqual([
      'adminNav',
      'contentRegistry',
      'manifest',
      'registry',
    ])
  })

  /**
   * The destinations, from the pure table rather than from the pass - so a
   * generated file's location is a function of the app root and of nothing a
   * plugin, a config or a filesystem could influence.
   */
  it('writes each one to its declared path under src/', () => {
    const paths = vitNodeGeneratedRegistryPaths(appRoot)

    for (const [name, file] of Object.entries(REGISTRIES)) {
      expect(asRelative(paths[name as keyof typeof REGISTRIES])).toBe(file)
    }

    for (const file of first) {
      expect(asRelative(file.path)).toBe(REGISTRIES[file.name])
      expect(asRelative(file.path)).toMatch(/^src\/[\w-]+\.gen\.ts$/)
    }
  })

  it('produces a populated manifest, so the assertions below mean something', () => {
    const manifest = first.find((file) => file.name === 'manifest')

    expect(manifest?.source).toContain('@vitnode/example:example-page')
  })
})

describe('the committed files are what the generator produces', () => {
  it.each(Object.values(REGISTRIES))('%s is up to date', (file) => {
    const generated = first.find((entry) => asRelative(entry.path) === file)

    expect(generated).toBeDefined()
    // `toBe` on the whole string rather than a diff of lines: the claim is
    // byte equality, and a message naming the file is what an author needs.
    expect(
      generated?.source,
      `${file} is out of date. Run \`pnpm dev\` or \`pnpm build\` and commit the result.`,
    ).toBe(committed(join(appRoot, file)))
  })
})

describe('the same tree generates the same bytes', () => {
  it('is byte-identical on a second pass', () => {
    expect(second.map((file) => [file.name, file.source])).toEqual(
      first.map((file) => [file.name, file.source]),
    )
  })

  it('names the same destinations on a second pass', () => {
    expect(second.map((file) => file.path)).toEqual(
      first.map((file) => file.path),
    )
  })
})

describe('generating is not writing', () => {
  /**
   * Two passes ran between these two readings. A generator that wrote would
   * have touched all four, and this test would then be measuring its own side
   * effects rather than the repository's state.
   */
  it('leaves every committed file untouched', () => {
    expect(mtimesAfter).toEqual(mtimesBefore)
  })
})

describe('who generated what is legible in the file', () => {
  /**
   * Five `*.gen.ts` files sit in `src/`, written by two different tools, and the
   * one thing an author needs from any of them is the name of the thing that
   * will overwrite their edit. So each says so, in its first lines.
   *
   * The distinction is not cosmetic: regenerating a VitNode registry means
   * running the app's build; regenerating `routeTree.gen.ts` means letting
   * `tanstackStart()` see the routes directory. Nothing VitNode generates may
   * claim the route tree, and nothing may claim to be VitNode's that is not.
   */
  it.each(Object.values(REGISTRIES))(
    '%s names VitNode as its generator',
    (file) => {
      const header = committed(join(appRoot, file)).slice(0, 400)

      expect(header).toContain('generated by VitNode')
      expect(header).toContain('vitnode:plugin-routes')
      expect(header).not.toContain('TanStack Router')
    },
  )

  it('leaves the route tree to TanStack Router', () => {
    const routeTree = join(appRoot, 'src/routeTree.gen.ts')

    expect(committed(routeTree).slice(0, 400)).toContain(
      'generated by TanStack Router',
    )
    expect(first.map((file) => file.path)).not.toContain(routeTree)
  })

  it('ends every generated file with exactly one newline', () => {
    for (const file of first) {
      expect(file.source.endsWith('\n')).toBe(true)
      expect(file.source.endsWith('\n\n')).toBe(false)
    }
  })
})

/**
 * Each of the five generated files has exactly one generator, and this is where
 * that is asserted rather than assumed.
 *
 * The failure it guards against has happened, and it is not subtle when it does:
 * two things writing `src/routeTree.gen.ts` overwrite each other forever, every
 * write trips the watcher, and the dev server looks like it is caught in an
 * inexplicable reload loop. `server.strictPort` is one half of the fix - a second
 * `vite dev` fails instead of quietly moving to port 3001 - and the other half is
 * that nothing outside `tanstackStart()` may generate a route tree, and nothing
 * outside `vitNodePluginRoutes()` may generate a registry.
 *
 * Read off the config and the manifest as text: a `package.json` script or a
 * second plugin is not something a running test can be asked about.
 */
describe('one generator per artifact', () => {
  const config = withoutComments(join(appRoot, 'vite.config.ts'))
  const manifest = JSON.parse(
    readFileSync(join(appRoot, 'package.json'), 'utf8'),
  ) as {
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  const scripts = Object.entries(manifest.scripts ?? {})

  it('mounts the VitNode registry generator once', () => {
    expect(config.match(/vitNodePluginRoutes\(/g)).toHaveLength(1)
  })

  it('mounts the route-tree generator once, as tanstackStart', () => {
    expect(config.match(/tanstackStart\(/g)).toHaveLength(1)
  })

  /**
   * `@tanstack/router-cli` provides the `tsr` binary - a *second* route
   * generator over the same `routeTree.gen.ts` that `tanstackStart()` already
   * writes. It was installed here and used by nothing, which is the worst of the
   * three states: no build depended on it, and it stayed one `tsr generate`
   * away from the reload loop. `create-vitnode-app` has never scaffolded it, for
   * the reason its own `tanstackWebDevDeps` comment gives.
   */
  it('installs no second route generator', () => {
    expect(Object.keys(manifest.devDependencies ?? {})).not.toContain(
      '@tanstack/router-cli',
    )
  })

  it('runs no generator from a script', () => {
    const offenders = scripts.filter(([, command]) =>
      /\btsr\b|routeTree|plugin-routes\.gen|admin-nav\.gen|content-registry\.gen/.test(
        command,
      ),
    )

    expect(offenders).toEqual([])
  })

  /**
   * `postinstall` runs `fumadocs-mdx`, which writes `.source/{server,browser}.ts`
   * so a typecheck works on a fresh clone before any Vite run. That is a
   * different artifact with a different owner, and it is the only generator
   * outside the Vite config - so it is named here to say that it is allowed and
   * that it does not touch these five files.
   */
  it('generates only the documentation collections outside Vite', () => {
    expect(manifest.scripts?.postinstall).toBe('fumadocs-mdx')
  })

  it('makes a second dev server fail rather than move', () => {
    expect(config).toMatch(/strictPort:\s*true/)
  })
})
