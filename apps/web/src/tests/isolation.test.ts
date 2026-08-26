import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')

const SKIP_DIRECTORIES = [
  '.next',
  '.output',
  '.source',
  '.turbo',
  'dist',
  'node_modules',
]

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return []

  const entries: string[] = []

  for (const name of readdirSync(directory)) {
    const path = join(directory, name)

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue
      entries.push(...filesUnder(path))
      continue
    }

    if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) entries.push(path)
  }

  return entries
}

const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, 'utf8').matchAll(
      /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier))

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`)

const offendersIn = (files: string[], forbidden: string[]): string[] =>
  files
    .filter((path) =>
      importsFrom(path).some((specifier) =>
        forbidden.some((entry) => matches(specifier, entry)),
      ),
    )
    .map((path) => relative(repoRoot, path))

/** Anything that only exists inside a TanStack Start app. */
const TANSTACK_ONLY = ['@tanstack/react-start', '@tanstack/react-router']

/** Anything that only exists inside a Next.js app. */
const NEXT_ONLY = ['next', 'server-only']

/**
 * next-intl's Next-only halves.
 *
 * The root entry is not on this list on purpose: it re-exports `use-intl`, which
 * is framework-free, and the API already uses `createTranslator` from it to
 * render emails and error messages in the user's language. These four are the
 * ones that reach for Next's request scope, its middleware or its build plugin.
 */
const NEXT_INTL_RUNTIME = [
  'next-intl/middleware',
  'next-intl/navigation',
  'next-intl/plugin',
  'next-intl/server',
]

describe('the repository root is where these tests think it is', () => {
  it('resolves to the workspace root', () => {
    // Every assertion below is vacuously true against an empty file list, so
    // a move of this file has to fail here rather than silently pass.
    expect(existsSync(join(repoRoot, 'pnpm-workspace.yaml'))).toBe(true)
  })
})

describe('the import scan finds what it is looking for', () => {
  // Every assertion below is a "found nothing" one, which an import scanner
  // that silently matches nothing also satisfies. These two are the control:
  // they point it at code that provably does import the forbidden things.
  it('finds the Next.js imports in the layer that is allowed them', () => {
    expect(
      offendersIn(
        filesUnder(join(repoRoot, 'packages/vitnode/src/content/next')),
        NEXT_ONLY,
      ),
    ).not.toEqual([])
  })

  it('finds the TanStack imports in this app', () => {
    expect(
      offendersIn(filesUnder(join(repoRoot, 'apps/web/src/routes')), [
        '@tanstack/react-router',
      ]),
    ).not.toEqual([])
  })
})

describe('adding TanStack Start does not reach the rest of the workspace', () => {
  const targets = [
    // The plain `@hono/node-server` process. Neither TanStack nor Next has a
    // runtime there, so an import fails when someone boots the API, not in CI.
    {
      files: () => filesUnder(join(repoRoot, 'apps/api/src')),
      name: 'apps/api',
    },
    // Loaded by `apps/api` and executed by drizzle-kit when it reads the tables.
    {
      files: () => [
        ...filesUnder(join(repoRoot, 'packages/vitnode/src/api')),
        ...filesUnder(join(repoRoot, 'packages/vitnode/src/database')),
      ],
      name: '@vitnode/core api + database layers',
    },
    // Adapter packages: they run wherever the API runs, framework-free.
    {
      files: () =>
        [
          'elasticsearch',
          'node-cron',
          'nodemailer',
          'resend',
          's3',
          'supabase-storage',
        ].flatMap((name) =>
          filesUnder(join(repoRoot, 'packages', name, 'src')),
        ),
      name: 'framework-independent packages',
    },
  ]

  it.each(targets)('$name has files to check', ({ files }) => {
    expect(files().length).toBeGreaterThan(0)
  })

  it.each(targets)('$name never imports TanStack Start', ({ files }) => {
    expect(offendersIn(files(), TANSTACK_ONLY)).toEqual([])
  })

  it.each(targets)('$name never imports Next.js', ({ files }) => {
    expect(offendersIn(files(), NEXT_ONLY)).toEqual([])
  })

  it.each(targets)(
    "$name never imports next-intl's Next-only entries",
    ({ files }) => {
      expect(offendersIn(files(), NEXT_INTL_RUNTIME)).toEqual([])
    },
  )
})

describe('the existing Next.js application stays Next-only', () => {
  const docsFiles = () => filesUnder(join(repoRoot, 'apps/docs'))

  it('has files to check', () => {
    expect(docsFiles().length).toBeGreaterThan(0)
  })

  it('never imports TanStack Start', () => {
    expect(offendersIn(docsFiles(), TANSTACK_ONLY)).toEqual([])
  })
})

describe('the TanStack Start application stays Next-free', () => {
  const webFiles = () => filesUnder(join(repoRoot, 'apps/web/src'))

  it('has files to check', () => {
    expect(webFiles().length).toBeGreaterThan(0)
  })

  it('never imports next/* or server-only', () => {
    // `@vitnode/core` splits its Next-only helpers into their own modules
    // precisely so an app that is not Next can use the rest. Importing one
    // here would drag `next/headers` into the Nitro build.
    expect(offendersIn(webFiles(), NEXT_ONLY)).toEqual([])
  })

  it("never imports next-intl's Next-only entries", () => {
    expect(offendersIn(webFiles(), NEXT_INTL_RUNTIME)).toEqual([])
  })

  it('does not depend on next', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'apps/web/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies?.next).toBeUndefined()
  })
})
