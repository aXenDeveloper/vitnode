import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Stage 17: `apps/web` is gone, and the things only it had are not.
 *
 * The deletion itself is the easy half and needs one line to state. The half
 * worth a test file is the other one: `apps/web` was a *whole VitNode
 * application*, not a documentation folder, and four of the artefacts it carried
 * existed nowhere else in the repository. Each was moved rather than deleted,
 * and each is the kind of loss that is silent for weeks -
 *
 *     migrations/            the versioned schema history. Deleting it does not
 *                            break a build; it breaks the next fresh database,
 *                            and `plugins/example` reads the SQL as text.
 *     docker-compose.yml      the only compose file in the repository. `pnpm
 *                            docker:dev` is step 3 of the contribution guide.
 *     logo_vitnode_dark.png   the image every email template points at.
 *     @vitnode/blog/pl.json   the only Polish translation of the blog plugin -
 *                            which now ships from the plugin itself, where it
 *                            belonged all along.
 *
 * So this file is mostly about the moves, not the removal. Static only: it reads
 * the filesystem and the manifests, and asks nothing that needs a running
 * anything.
 *
 * `docs-source.test.ts` owns the documentation *content* side of the same stage -
 * that the collection is here, that "Open in GitHub" points at
 * `apps/web/content/docs`, and that no page tells a contributor otherwise.
 *
 * Deliberately not asserted here: that no source file in the monorepo still
 * mentions `apps/web` in a comment. Half the packages explain the migration in
 * prose, which is worth keeping, and a scan that cannot tell an explanation from
 * a dependency is a test that punishes documentation.
 */
const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../..')
const repoRoot = resolve(appRoot, '../..')

const json = (path: string): unknown =>
  JSON.parse(readFileSync(join(repoRoot, path), 'utf8'))

const manifest = (
  path: string,
): {
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
} =>
  json(path) as {
    dependencies?: Record<string, string>
    scripts?: Record<string, string>
  }

describe('the legacy Next.js application', () => {
  it('does not exist', () => {
    expect(existsSync(join(repoRoot, 'apps/web'))).toBe(false)
  })

  it('leaves two applications behind it, and neither is a docs site', () => {
    // `apps/*` is a pnpm workspace glob, so a directory here is a package
    // whether or not anything references it by name. Directories only - a
    // `.DS_Store` is not an application.
    const apps = readdirSync(join(repoRoot, 'apps'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    expect(apps).toEqual(['api', 'web'])
  })

  it('is named by no workspace manifest', () => {
    // The scripts a `docs` workspace answered - `pnpm --filter docs …`, and the
    // turbo tasks that fanned out to it. A task with no provider is not an
    // error in turbo; it simply does nothing, which is the failure worth
    // catching here rather than in somebody's terminal.
    for (const path of ['package.json', 'turbo.json', 'pnpm-workspace.yaml']) {
      expect(readFileSync(join(repoRoot, path), 'utf8'), path).not.toMatch(
        /apps\/docs|filter[= ]+docs\b/,
      )
    }
  })
})

/**
 * The four artefacts, at their new addresses.
 *
 * Each assertion names *why* the file matters rather than only that it is there,
 * because "a PNG is missing" is not a failure anybody can act on.
 */
describe('what only the deleted application had', () => {
  it('kept the whole versioned migration history', () => {
    const migrations = readdirSync(join(repoRoot, 'apps/api/migrations'))

    // A floor rather than the exact count, so generating a migration never
    // fails this. Forty is what moved across.
    expect(migrations.length).toBeGreaterThanOrEqual(40)

    // Every entry is a Drizzle Kit v3 directory with the SQL a fresh database
    // actually runs. A folder of empty folders would satisfy a length check.
    for (const name of migrations) {
      expect(
        existsSync(
          join(repoRoot, 'apps/api/migrations', name, 'migration.sql'),
        ),
        name,
      ).toBe(true)
    }
  })

  it('has an application that can apply them', () => {
    // `apps/web` was the only workspace with a `db:migrate` script, so root
    // `pnpm db:migrate` had no provider at all the moment it was deleted.
    expect(manifest('apps/api/package.json').scripts).toHaveProperty(
      'db:migrate',
    )

    // And the config that says where they live, which already pointed here -
    // `out: "./migrations/"` was declaring a directory that did not exist.
    expect(
      readFileSync(join(repoRoot, 'apps/api/drizzle.config.ts'), 'utf8'),
    ).toMatch(/out:\s*['"]\.\/migrations\/?['"]/)
  })

  it('kept the compose file the contribution guide tells people to run', () => {
    const compose = readFileSync(
      join(repoRoot, 'apps/api/docker-compose.yml'),
      'utf8',
    )

    // Postgres and Redis both, and the build context relative to the new
    // location - `apps/api` is the same depth as `apps/web` was, which is what
    // makes `../../docker/postgres` still resolve.
    expect(compose).toContain('../../docker/postgres')
    expect(compose).toMatch(/redis:/)

    expect(manifest('apps/api/package.json').scripts).toHaveProperty(
      'docker:dev',
    )
  })

  it('kept the email logo, where the app that serves / can serve it', () => {
    expect(existsSync(join(appRoot, 'public/logo_vitnode_dark.png'))).toBe(true)
  })

  /**
   * And gave it to the plugin rather than to this app.
   *
   * It landed in `apps/web/src/locales/@vitnode/blog/pl.json` when `apps/web`
   * was deleted, registered as an *app override* - which is what an app writes
   * when it wants to reword a string a package already ships. This was not a
   * rewording: it was the only Polish the blog plugin had, so every other
   * installation of `@vitnode/blog` still rendered English labels in a Polish
   * AdminCP, and so did this repository's own `apps/api` when it sent an email.
   *
   * A plugin's canonical translation belongs to the plugin. It ships from
   * `plugins/blog/src/locales/pl.json` now, through the plugin's own locale
   * barrel, and this app registers it beside the English in
   * `src/locales/packages.ts` the way it registers every other package's.
   */
  it('gave the blog plugin its Polish translation to ship', () => {
    const messages = json('plugins/blog/src/locales/pl.json') as Record<
      string,
      unknown
    >

    // The plugin's own namespace, which is what the merge reads. The flat
    // `@vitnode/blog:posts:can_edit` keys beside it are the staff-permission
    // labels, which are top-level by design - see
    // `packages/vitnode/src/lib/i18n`.
    expect(Object.keys(messages)).toContain('@vitnode/blog')
    expect(messages['@vitnode/blog']).toMatchObject({ title: 'Blog' })

    // A file nothing loads is the same as no file: the plugin's barrel, which
    // `apps/api` reads directly, and this app's bundler-safe loader map.
    expect(
      readFileSync(join(repoRoot, 'plugins/blog/src/locales/index.ts'), 'utf8'),
    ).toContain('./pl.json')
    expect(
      readFileSync(join(appRoot, 'src/locales/packages.ts'), 'utf8'),
    ).toContain('@vitnode/blog/locales/pl.json')

    // And it is no longer an app override, which is what it never was. Read
    // without comments: `app.ts` explains the move, and prose may name what
    // code may not do.
    expect(existsSync(join(appRoot, 'src/locales/@vitnode'))).toBe(false)
    expect(
      readFileSync(join(appRoot, 'src/locales/app.ts'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    ).not.toContain('@vitnode/blog')
  })
})
