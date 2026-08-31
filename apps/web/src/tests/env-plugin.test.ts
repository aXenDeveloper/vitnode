import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { withoutComments } from './source'

/**
 * What this application publishes to its own browser bundle, and nothing else.
 *
 * How `vitNodeEnv` *behaves* - that it loads the whole `.env` for the server,
 * that a platform variable beats a file, that an unset key is defined as
 * `undefined` rather than left as a read that throws, that a secret cannot
 * arrive by having a public-looking name - is the package's, and is tested there
 * (`packages/vitnode/src/framework/vite/env.test.ts`). Repeating any of it here
 * would be a second copy of an argument that has one home.
 *
 * What is left is the only part this app decides: which key it adds to the
 * package's list. That is a security-relevant line in `vite.config.ts` - every
 * name on it is compiled into JavaScript anyone can read - so it is worth a test
 * that fails when somebody adds a second one without meaning to.
 */
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path: string) => readFileSync(join(appRoot, path), 'utf8')

/**
 * Keys this app adds on top of the package's two, and there are none.
 *
 * The list is empty because nothing in this app's browser bundle reads an
 * environment variable the package does not already inline
 * (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEB_URL`). It was not always: the
 * migration published a second origin here so the browser could build hrefs
 * into the application that still served the un-migrated routes. Every URL is
 * this application's now, so the key, its reader and the argument are all gone.
 *
 * Kept as an empty list rather than deleted so the two assertions below still
 * run: adding a key back has to be a deliberate edit to this file.
 */
const APP_CLIENT_ENV: string[] = []

describe('the environment this app publishes to the browser', () => {
  const config = () => withoutComments(join(appRoot, 'vite.config.ts'))

  it('takes both plugins from the package rather than owning copies', () => {
    // They used to be `apps/web/vitnode-env.ts` and
    // `apps/web/vitnode-plugin-routes.ts` - 397 lines of framework every VitNode
    // app on Vite would have had to copy and then keep in step.
    expect(config()).toContain("from '@vitnode/core/framework/vite'")
  })

  it('adds exactly the keys this list names', () => {
    const call = /vitNodeEnv\(\{\s*clientEnv:\s*\[([^\]]*)\]/.exec(config())
    const named = [...(call?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect(named).toStrictEqual(APP_CLIENT_ENV)
  })

  it('calls the plugin with no argument at all while that list is empty', () => {
    // The shape the empty list should produce, stated separately because the
    // assertion above passes for `vitNodeEnv({ clientEnv: [] })` too - and a
    // leftover empty option is a worse thing to leave behind than a wrong one,
    // since it reads as "this app publishes something" to everybody who greps.
    expect(config()).toMatch(/vitNodeEnv\(\)/)
    expect(config()).not.toContain('clientEnv')
  })

  it('names nothing that is not a public key', () => {
    // `NEXT_PUBLIC_*` is the naming convention `CONFIG` and Next.js both use for
    // "this is readable by anybody who opens devtools". A key without the prefix
    // on this list is either a mistake or a secret.
    for (const key of APP_CLIENT_ENV) {
      expect(key.startsWith('NEXT_PUBLIC_')).toBe(true)
    }
  })

  it('names no origin but its own', () => {
    // The legacy origin, gone from the one file that configured it. A second
    // web origin is not a thing a VitNode install has any more, so a `.env`
    // template offering one would be configuration nobody can use.
    expect(read('.env.example')).not.toContain('NEXT_PUBLIC_LEGACY_WEB_URL')
    expect(config()).not.toContain('NEXT_PUBLIC_LEGACY_WEB_URL')
  })

  it('hands the plugin routes generator this app’s own root', () => {
    // A Vite config is loaded with the working directory set to wherever the
    // command ran, which in this monorepo is regularly the repository root - so
    // the generator is told where the app is rather than guessing.
    expect(config()).toMatch(
      /vitNodePluginRoutes\(\{\s*appRoot:\s*import\.meta\.dirname\s*\}\)/,
    )
  })
})
