import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { i18n as webI18n } from '#/i18n'

import { i18n as apiI18n } from '../../../api/src/i18n'

/**
 * An installation declares its languages once, and the database is seeded from
 * that declaration.
 *
 * Static and pure: two config modules are imported as the data they are, and
 * three source files are read as text. No Postgres, no bootstrap, no dev server.
 *
 * ## The regression
 *
 * `vitnode db:prepare` seeds `core_languages`, and it used to find out which
 * languages to seed by calling `getConfig({ type: "config", optional: true })` -
 * a *recursive filesystem search* from `process.cwd()` for a
 * `src/vitnode.config.ts`. The command runs from the app that owns the schema,
 * which here is `apps/api` and in every generated monorepo is `apps/api` too.
 * There is no frontend config below that directory. The search found nothing,
 * `optional: true` swallowed it, and the fallback seeded `en` alone into a
 * database whose site serves `en` and `pl` - so `pl` had no row, and everything
 * keyed on one (`core_languages_words`, localized content, the AdminCP's
 * language switcher) had nowhere to put a Polish string.
 *
 * The seed reads `VitNodeApiConfig.i18n` now, and nothing looks for a sibling
 * application. What that moves onto this file is the other half of the
 * contract: the API config has to *have* the installation's languages in it.
 *
 * ## Why two files rather than one
 *
 * `apps/web` and `apps/api` are separate packages, so neither can import the
 * other's module - and a shared workspace package for two object literals would
 * be a package to publish, version and explain. They are two declarations that
 * must agree, and this is what makes "must agree" a build failure rather than a
 * comment.
 *
 * A generated *single* app has no such split: `src/i18n.ts` is read by
 * `vitnode.shell.config.ts` and by `vitnode.api.config.ts` in the same package,
 * which is the arrangement `apps/web` also uses for its own in-process API.
 */

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '../..')
const repoRoot = resolve(appRoot, '../..')

const sourceOf = (path: string): string =>
  readFileSync(join(repoRoot, path), 'utf8')

/** Source with its comments removed - prose may name what code may not do. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('the two halves of this installation', () => {
  it('serve the same languages', () => {
    expect(apiI18n.locales.map((locale) => locale.code)).toEqual(
      webI18n.locales.map((locale) => locale.code),
    )
  })

  it('agree on the default language', () => {
    expect(apiI18n.defaultLocale).toBe(webI18n.defaultLocale)
  })

  /**
   * The seed writes it to every `core_languages` row, so a disagreement here is
   * a database whose timezone depends on which app migrated it.
   */
  it('agree on the timezone', () => {
    expect(apiI18n.timeZone).toBe(webI18n.timeZone)
  })

  /** The list this repository actually serves, spelled out. */
  it('serve English and Polish', () => {
    expect(webI18n.locales.map((locale) => locale.code)).toEqual(['en', 'pl'])
    expect(webI18n.defaultLocale).toBe('en')
  })
})

describe('every API config declares the installation locales', () => {
  /**
   * By reference rather than by value: an inline list in a config is a second
   * declaration, and a second declaration is what drifts.
   */
  it.each([
    ['apps/api', 'apps/api/src/vitnode.api.config.ts'],
    ['apps/web', 'apps/web/src/vitnode.api.config.ts'],
  ])('%s passes the shared declaration to buildApiConfig', (_label, file) => {
    const code = withoutComments(sourceOf(file))

    // `.js` in `apps/api`, which compiles with `moduleResolution: nodenext`.
    expect(code).toMatch(/import \{ i18n \} from ['"]\.\/i18n(?:\.js)?['"]/)
    expect(code).toMatch(/^\s*i18n,\s*$/m)
    // Not a list written out again beside the import.
    expect(code).not.toMatch(/i18n:\s*\{/)
  })

  /**
   * And the web app's frontend config reads the very same module, through the
   * shell config it spreads. One file, two configs, in the app that has both.
   */
  it('apps/web builds its frontend config from the same module', () => {
    expect(
      withoutComments(sourceOf('apps/web/src/vitnode.shell.config.ts')),
    ).toMatch(/import \{ i18n \} from ['"]\.\/i18n['"]/)
  })
})

describe('the database bootstrap discovers no frontend', () => {
  const bootstrap = withoutComments(
    sourceOf('packages/vitnode/scripts/prepare-database.ts'),
  )

  /**
   * The mechanism, not just the outcome. `findConfigFile` walks directories;
   * a bootstrap that calls it for a *frontend* config is the bug, whatever it
   * does with the answer.
   */
  it('loads only the API config', () => {
    expect(bootstrap).not.toContain('type: "config"')
    expect(bootstrap).not.toContain('optional: true')
    expect(bootstrap.match(/getConfig\(\{ type: "api\.config" \}\)/g)).not.toBe(
      null,
    )
  })

  it('names no sibling application', () => {
    expect(bootstrap).not.toMatch(/["'`][^"'`]*\.\.\/(?:web|api)\b/)
    expect(bootstrap).not.toContain('vitnode.config.ts')
  })
})
