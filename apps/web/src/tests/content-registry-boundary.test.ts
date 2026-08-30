import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The boundary the generated content registry exists to draw, checked against
 * the files a bundler would actually follow.
 *
 * Static only, and over `dist` rather than source. That is the point: the
 * browser gets each plugin's *built* module through a literal specifier, so the
 * question "does anything in there reach Next" is a question about the built
 * graph. `content-registry.test.ts` beside this one imports the same modules to
 * check the registry behaves; this one never imports them, because a graph walk
 * must not depend on whether a module happens to evaluate under Node.
 *
 * The failure it guards against is not subtle but it is invisible until late: a
 * plugin adds an editor field that reaches `next-intl`, the Next.js AdminCP
 * keeps working, and the TanStack build fails somewhere in `node_modules` with a
 * message naming neither the plugin nor the field.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appSrc = resolve(here, '..')
const repoRoot = resolve(here, '../../../..')
const requireFromApp = createRequire(join(appSrc, '../package.json'))

/** What may never appear in a module the browser loads for a content screen. */
const FORBIDDEN = [
  'next',
  'next-intl',
  'next-intl/server',
  'next-intl/navigation',
  'next/navigation',
  'next/dynamic',
  'next/cache',
  'next/headers',
  'server-only',
]

const isForbidden = (specifier: string): boolean =>
  FORBIDDEN.includes(specifier) ||
  specifier.startsWith('next/') ||
  specifier.startsWith('next-intl/')

/**
 * Every specifier a built module names, static and dynamic alike.
 *
 * `import()` is included deliberately. A lazy boundary changes *which chunk* a
 * module lands in, not whether the browser can load it - so an editor behind
 * `React.lazy` that reaches `next/navigation` is exactly as broken, just later.
 */
const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, 'utf8').matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g,
    ),
  ]
    .map((match) => match[1] ?? match[2])
    .filter((specifier): specifier is string => Boolean(specifier))

interface Violation {
  file: string
  specifier: string
}

/**
 * Walks out from the plugin modules the generated registry imports.
 *
 * Follows relative specifiers and `@vitnode/*` subpaths - the workspace - and
 * stops at third-party packages, which are not this boundary's business. A
 * forbidden specifier is recorded rather than followed: the offence is naming
 * it, and `next` resolves perfectly well in this repo.
 */
const walkRegistryGraph = (
  entrySpecifiers: readonly string[],
): { files: number; violations: Violation[] } => {
  const seen = new Set<string>()
  const violations: Violation[] = []

  const visit = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)

    for (const specifier of importsFrom(file)) {
      if (isForbidden(specifier)) {
        violations.push({ file: relative(repoRoot, file), specifier })
        continue
      }

      let target: null | string = null

      try {
        if (specifier.startsWith('.')) {
          target = requireFromApp.resolve(resolve(dirname(file), specifier))
        } else if (specifier.startsWith('@vitnode/')) {
          target = requireFromApp.resolve(specifier)
        }
      } catch {
        // A specifier that does not resolve is `package-boundary.test.ts`'s
        // problem, not this one's.
        target = null
      }

      if (target === null) continue
      // Third-party packages are out of scope; workspace ones are the graph.
      if (target.includes('node_modules') && !target.includes('@vitnode')) {
        continue
      }

      visit(target)
    }
  }

  entrySpecifiers.forEach((specifier) => {
    visit(requireFromApp.resolve(specifier))
  })

  return { files: seen.size, violations }
}

/**
 * The generated file, as text.
 *
 * Read rather than imported, so the assertions below are about what was
 * *written* - which specifiers, in which order - instead of what it evaluates
 * to.
 */
const generated = readFileSync(join(appSrc, 'content-registry.gen.ts'), 'utf8')

const generatedSpecifiers = (): string[] =>
  [...generated.matchAll(/from '([^']+)'/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.endsWith('/admin/content'))

describe('the generated content registry', () => {
  it('exists, and names the configured plugins', () => {
    expect(generatedSpecifiers()).toEqual([
      '@vitnode/blog/admin/content',
      '@vitnode/example/admin/content',
    ])
  })

  /**
   * The rule the whole design rests on: a bundler must be able to follow every
   * specifier without running anything. A registry reached through
   * `import(`${pluginId}/admin/content`)` would type-check, work in dev, and
   * ship a browser bundle with no plugin screens in it at all.
   */
  it('reaches every plugin by a literal specifier', () => {
    expect(generated).not.toContain('import(')
    expect(generated).not.toContain('${')

    const imports = generated
      .split('\n')
      .filter((line) => line.startsWith('import '))

    expect(imports.length).toBeGreaterThan(0)
    imports.forEach((line) => {
      expect(line).toMatch(/ from '[^'`$]+'$/)
    })
  })

  /**
   * Navigation and content registration are written from one pass over one
   * configured plugin list, so a plugin that has both must appear in both. The
   * two projections carry different payloads - links versus screens - and are
   * deliberately not derived from each other, which is exactly why they are
   * worth checking against each other.
   */
  it('lists the same plugins as the navigation projection', () => {
    const nav = readFileSync(join(appSrc, 'admin-nav.gen.ts'), 'utf8')
    const navPlugins = [...nav.matchAll(/from '([^']+)\/admin\/nav'/g)].map(
      (match) => match[1],
    )
    const contentPlugins = generatedSpecifiers().map((specifier) =>
      specifier.slice(0, -'/admin/content'.length),
    )

    expect(contentPlugins).toEqual(navPlugins)
  })
})

describe('the browser-safe content graph', () => {
  const entries = generatedSpecifiers()

  it('has a built graph to check', () => {
    // Every assertion below is vacuously true against an unbuilt plugin, so the
    // one thing that must not pass silently is its absence.
    entries.forEach((specifier) => {
      expect(
        existsSync(requireFromApp.resolve(specifier)),
        `run \`turbo build:plugins\` first (${specifier})`,
      ).toBe(true)
    })

    expect(walkRegistryGraph(entries).files).toBeGreaterThan(20)
  })

  it('never reaches next, next-intl or server-only', () => {
    expect(walkRegistryGraph(entries).violations).toEqual([])
  })
})

/**
 * The server config stays on the server.
 *
 * `vitnode.config.ts` carries message loaders and API wiring, and in this app it
 * is reached only through `src/server/messages.server.ts`. The content registry
 * exists so the AdminCP's content screens never need it - so an import of it
 * from anywhere in the browser graph would mean the projection had been
 * bypassed, and the whole plugin registry pulled into the bundle behind it.
 */
describe('apps/web does not depend on the server VitNodeConfig', () => {
  /**
   * The only module this app *ships* that may import `src/vitnode.config.ts`.
   *
   * `src/vitnode.api.config.ts` is not on it and does not need to be: it imports
   * `buildApiConfig` from `@vitnode/core/vitnode.config`, which is the package's
   * builder rather than this app's config object.
   */
  const CONFIG_IMPORTERS = ['src/server/messages.server.ts']

  /**
   * Every `.ts`/`.tsx` file under `apps/web/src` that ends up in a build -
   * generated ones included, test files not.
   *
   * Tests are excluded because the property is about the *shipped* graph: this
   * suite's neighbour `messages.test.ts` reads the config on purpose, to assert
   * the message wiring, and nothing it imports reaches a bundle. Including them
   * would make the allowlist grow every time somebody writes a test about the
   * config, which is exactly the kind of churn that gets an assertion deleted.
   */
  const appSources = (directory: string): string[] => {
    const entries: string[] = []

    for (const name of readdirSync(directory)) {
      const path = join(directory, name)

      if (statSync(path).isDirectory()) {
        if (name === 'node_modules' || name === 'tests') continue
        entries.push(...appSources(path))
        continue
      }

      if (/\.tsx?$/.test(name) && !/\.test(-d)?\.tsx?$/.test(name)) {
        entries.push(path)
      }
    }

    return entries
  }

  /**
   * Whether a specifier names *this app's* config module.
   *
   * `#/vitnode.config` and `./vitnode.config`, but not
   * `@vitnode/core/vitnode.config` - the package export is the builder every
   * app calls, and `vitnode.shell.config.ts` imports its type. Matching the
   * substring alone would fail on both and say nothing true.
   */
  const importsAppConfig = (specifier: string): boolean =>
    /^[#.].*\/vitnode\.config$/.test(specifier)

  it('is imported by exactly the modules allowed to read it', () => {
    // A real scan rather than a spot check: the failure this guards against is
    // a *new* module reaching for the config, which naming the existing ones
    // could never catch. Anybody who adds one has to add it here and say why.
    // The previous version of this test only asserted that the allowlisted file
    // existed, so it could not fail for the reason it was written.
    const importers = appSources(appSrc)
      .filter((path) => importsFrom(path).some(importsAppConfig))
      .map((path) => relative(join(repoRoot, 'apps/web'), path))
      .sort()

    expect(importers).toEqual(CONFIG_IMPORTERS)
  })

  it('is looking at a real file list', () => {
    // The scan above is vacuously true against an empty walk, and the allowlist
    // is only meaningful if the file it names is really there.
    expect(appSources(appSrc).length).toBeGreaterThan(20)
    CONFIG_IMPORTERS.forEach((file) => {
      expect(existsSync(join(repoRoot, 'apps/web', file)), file).toBe(true)
    })
  })
})
