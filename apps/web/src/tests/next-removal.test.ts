import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { withoutComments } from './source'

/**
 * The Next.js cutover, asserted rather than remembered.
 *
 * Stage 17 removed the last Next.js runtime from this repository. The removal
 * itself is a one-time act; what this file is for is the year afterwards, when
 * someone copies a snippet out of an old branch, or a plugin author reaches for
 * `next/navigation` out of habit, or a dependency is re-added because a stale
 * `next.config.ts` in a template made it look required.
 *
 * Every assertion here is static: file existence, manifest contents, and import
 * specifiers read off disk. Nothing is executed and nothing is type-checked.
 *
 * SCOPING is the load-bearing detail. This repository documents itself at
 * length, and Next.js is named constantly in prose - migration notes, doc
 * comments explaining why a file no longer exists, `content/docs` guides
 * describing the history. A naive `grep -r next` fails on the explanation
 * instead of on the code, and a test that cries wolf gets deleted. So:
 *
 *   - only source extensions are read; `.md`/`.mdx` are never scanned
 *   - comments are stripped before scanning (see `./source`)
 *   - imports are matched on the specifier, anchored to the closing quote, so
 *     `next-themes`, `next-intl` and `@bprogress/next` cannot masquerade as
 *     `next`
 *
 * On packages merely *named* "next-something": a third-party package with
 * optional Next support is not Next.js ownership, and banning it by name would
 * be cargo cult. `next-intl` is banned because VitNode deliberately moved to
 * `use-intl`, its own framework-neutral core - not because of its name.
 */
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

/** Directories that are build output, dependencies, or VCS bookkeeping. */
const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.nitro',
  '.output',
  '.source',
  '.tanstack',
  '.turbo',
  '.vercel',
  '.vinxi',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

/** The workspace roots. `scripts/` is release tooling and counts as ours. */
const WORKSPACE_ROOTS = ['apps', 'packages', 'plugins', 'scripts']

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  return readdirSync(directory).flatMap((name) => {
    if (SKIP_DIRECTORIES.has(name)) return []

    const path = join(directory, name)

    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const workspaceFiles = WORKSPACE_ROOTS.flatMap((root) =>
  filesUnder(join(repoRoot, root)),
)

const asRepoPath = (path: string): string =>
  relative(repoRoot, path).split(sep).join('/')

/**
 * The one directory whose whole purpose is to contain Next.js imports.
 *
 * `packages/vitnode/test-fixtures/next-specimen/` is a deliberate two-file
 * Next.js import graph. Every "reaches nothing from `next/*`" assertion in this
 * repository is a negative one, and a scanner that silently matches nothing
 * satisfies all of them - so the specimen is the control that proves the
 * scanners can still detect what they are looking for.
 *
 * Safe to exempt because it is inert: it sits outside `src`, outside
 * `tsconfig.json`'s `include`, is imported by nothing but the scanners
 * themselves, and `next` is not installed, so it could not resolve even if
 * something did import it. The dependency assertions above independently
 * guarantee that last part.
 *
 * Named as an exact path rather than a `test-fixtures/` glob, deliberately: a
 * future fixture should have to justify itself here rather than inherit a pass
 * by being filed in the right folder.
 */
const NEXT_SPECIMEN = join(
  repoRoot,
  'packages/vitnode/test-fixtures/next-specimen',
)

/**
 * The other boundary scanners, which necessarily quote what they forbid.
 *
 * `packages/vitnode/src/next-boundary.test.ts` is this file's counterpart
 * inside `@vitnode/core`: it walks that package's import graph and asserts the
 * same absence in more depth. To test its own comment-stripping it embeds a
 * specimen string - `'expect(x).not.toMatch(/from "next-intl/)'` - which is a
 * quoted specifier in an import position as far as any regex is concerned.
 *
 * Exempting a scanner from another scanner is a real hole, so it is kept to
 * exact paths and justified one by one rather than pattern-matched on
 * `*boundary*` or `*.test.ts`. Both entries here are files whose only subject is
 * the Next.js boundary; neither ships, and neither is reachable from runtime
 * code.
 */
const PEER_SCANNERS = [
  join(repoRoot, 'packages/vitnode/src/next-boundary.test.ts'),
]

/**
 * Every source file except this one and the specimen.
 *
 * A test that bans a string has to contain the string, so scanning itself is a
 * guaranteed false positive. The self-exclusion is deliberately `!==` on the
 * resolved path rather than a name pattern, so a second file cannot quietly opt
 * itself out by copying the name.
 */
const sourceFiles = workspaceFiles
  .filter((path) =>
    SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)),
  )
  .filter((path) => path !== fileURLToPath(import.meta.url))
  .filter((path) => !path.startsWith(NEXT_SPECIMEN + sep))
  .filter((path) => !PEER_SCANNERS.includes(path))

const packageManifests = [
  join(repoRoot, 'package.json'),
  ...workspaceFiles.filter((path) => path.endsWith(`${sep}package.json`)),
]

const readManifest = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>

/**
 * Dependency names that mean "this package builds or runs on Next.js".
 *
 * `next` itself, the `@next/*` scope (SWC binaries, the bundle analyzer, the
 * ESLint plugin), `eslint-config-next`, and `next-intl` - the last for the
 * reason given at the top of the file.
 */
const isNextDependency = (name: string): boolean =>
  name === 'next' ||
  name.startsWith('@next/') ||
  name === 'eslint-config-next' ||
  name === 'next-intl' ||
  name.startsWith('next-intl/')

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

describe('the Next.js application is gone', () => {
  it('has no apps/web directory', () => {
    // The Next.js host. Its documentation content moved to `apps/web/content`
    // in Stage 16 and its runtime was deleted in Stage 17.
    expect(existsSync(join(repoRoot, 'apps/web'))).toBe(false)
  })

  it('has no Next.js config file in any workspace package', () => {
    const offenders = workspaceFiles
      .filter((path) => {
        const name = path.split(sep).at(-1) ?? ''

        return (
          name === 'next.config.ts' ||
          name === 'next.config.js' ||
          name === 'next.config.mjs' ||
          name === 'next-env.d.ts'
        )
      })
      .map(asRepoPath)

    expect(offenders).toEqual([])
  })
})

describe('no workspace package depends on Next.js', () => {
  it.each(packageManifests.map((path) => [asRepoPath(path), path] as const))(
    '%s declares no Next dependency',
    (_name, path) => {
      const manifest = readManifest(path)

      const offenders = DEPENDENCY_FIELDS.flatMap((field) => {
        const block = manifest[field]
        if (typeof block !== 'object' || block === null) return []

        return Object.keys(block)
          .filter(isNextDependency)
          .map((dependency) => `${field}.${dependency}`)
      })

      expect(offenders).toEqual([])
    },
  )

  it('declares no Next package in peerDependenciesMeta', () => {
    // `peerDependenciesMeta` marks a peer optional. A leftover entry here is
    // harmless to install but advertises support that no longer exists.
    const offenders = packageManifests.flatMap((path) => {
      const meta = readManifest(path).peerDependenciesMeta
      if (typeof meta !== 'object' || meta === null) return []

      return Object.keys(meta)
        .filter(isNextDependency)
        .map((dependency) => `${asRepoPath(path)}: ${dependency}`)
    })

    expect(offenders).toEqual([])
  })
})

describe('no source file imports Next.js', () => {
  /**
   * A quoted module specifier, anchored on both sides.
   *
   * An opening quote immediately before the name, and either the closing quote
   * or a `/` immediately after it. `next-themes` and `@bprogress/next` are
   * therefore not `next` - which is the point, since those are third-party
   * packages that merely carry the name and run without Next.js.
   */
  const specifier = (name: string) => String.raw`['"]${name}(?:\/[^'"]*)?['"]`

  /**
   * The specifier in an import position: `from 'x'`, `import 'x'`,
   * `import('x')`, `require('x')`.
   *
   * Anchoring on the import keyword rather than on the quotes alone is what
   * keeps this test honest. Several files in this repository legitimately name
   * these specifiers as data - `packages/config/eslint.react.config.mjs` bans
   * them by name, and `apps/web/src/tests/isolation.test.ts` asserts against a
   * list of them. Matching bare quotes would fail on the guardrails instead of
   * on a violation, which is exactly the sort of false alarm that gets a test
   * deleted rather than fixed.
   */
  const importOf = (name: string) =>
    new RegExp(
      String.raw`(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)` +
        specifier(name),
    )

  /**
   * The specifier in a type-augmentation position: `declare module 'x'` and
   * `/// <reference types="x" />`.
   *
   * A separate check because it is a separate mistake, and a real one: a
   * `global.d.ts` that augments `next-intl`'s `AppConfig` to type its message
   * keys depends on `next-intl`'s types just as surely as an import does, and
   * `use-intl` - which owns `AppConfig` and re-exports it - is where that
   * augmentation belongs now.
   */
  const augmentationOf = (name: string) =>
    new RegExp(
      String.raw`(?:\bdeclare\s+module\s+|\breference\s+types\s*=\s*)` +
        specifier(name),
    )

  const offendersMatching = (expression: RegExp): string[] =>
    sourceFiles
      .filter((path) => expression.test(withoutComments(path)))
      .map(asRepoPath)

  it('imports nothing from `next` or `next/*`', () => {
    expect(offendersMatching(importOf('next'))).toEqual([])
  })

  it('imports nothing from `next-intl`', () => {
    // VitNode's translations run on `use-intl`, which is `next-intl`'s
    // framework-neutral core and a direct dependency of `@vitnode/core`.
    expect(offendersMatching(importOf('next-intl'))).toEqual([])
  })

  it('augments no Next.js module type', () => {
    expect(offendersMatching(augmentationOf('next'))).toEqual([])
    expect(offendersMatching(augmentationOf('next-intl'))).toEqual([])
  })
})

describe('no build script drives Next.js', () => {
  it('has no `next dev` / `next build` / `next start` script', () => {
    const NEXT_COMMAND = /(?:^|&&|\|\||;|\s)next\s+(?:dev|build|start|lint)\b/

    const offenders = packageManifests.flatMap((path) => {
      const scripts = readManifest(path).scripts
      if (typeof scripts !== 'object' || scripts === null) return []

      return Object.entries(scripts as Record<string, string>)
        .filter(([, command]) => NEXT_COMMAND.test(command))
        .map(([name]) => `${asRepoPath(path)}: ${name}`)
    })

    expect(offenders).toEqual([])
  })

  it('caches no `.next` output directory in turbo.json', () => {
    const turbo = readFileSync(join(repoRoot, 'turbo.json'), 'utf8')

    expect(turbo).not.toContain('.next/')
  })
})

describe('the migration-only environment is gone', () => {
  it('reads no legacy-origin variable', () => {
    /**
     * `NEXT_PUBLIC_LEGACY_WEB_URL` named the origin still serving the routes
     * this application had not taken over yet. With the cutover complete there
     * is no other origin, so a reader of it is either dead code or a bug.
     *
     * Matched as a *read* - `process.env.X` or `import.meta.env.X` - and not as
     * a bare mention. `./no-legacy-origin.test.ts` and `./env-plugin.test.ts`
     * both assert the variable's absence, which means they contain its name on
     * purpose; a substring scan would fail on the guardrails rather than on a
     * violation. That file covers `apps/web` in depth. This one is the
     * repository-wide backstop for `packages/` and `plugins/`.
     *
     * Deliberately narrow in the other direction too. `NEXT_PUBLIC_API_URL` and
     * `NEXT_PUBLIC_WEB_URL` survive under those names: they are a live
     * configuration contract - read by `@vitnode/core`'s config, the docker
     * compose files, turbo's env list and the `create-vitnode-app` templates -
     * not migration residue. Renaming them would break every existing
     * deployment for cosmetic reasons.
     */
    const READS_LEGACY_ORIGIN =
      /(?:process|import\.meta)\.env(?:\.NEXT_PUBLIC_LEGACY_WEB_URL\b|\[['"]NEXT_PUBLIC_LEGACY_WEB_URL['"]\])/

    const offenders = sourceFiles
      .filter((path) => READS_LEGACY_ORIGIN.test(withoutComments(path)))
      .map(asRepoPath)

    expect(offenders).toEqual([])
  })

  it('declares no legacy-origin variable in any .env example', () => {
    // `.env.example` only. A developer's own `.env` is gitignored, is not
    // repository content, and may legitimately still hold anything at all.
    const offenders = workspaceFiles
      .filter((path) => path.endsWith('.env.example'))
      .filter((path) =>
        readFileSync(path, 'utf8').includes('NEXT_PUBLIC_LEGACY_WEB_URL'),
      )
      .map(asRepoPath)

    expect(offenders).toEqual([])
  })
})
