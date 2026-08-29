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
 * The one key beyond the package's two.
 *
 * Temporary migration infrastructure: the origin still serving the routes this
 * app has not taken over. It is inlined because `src/migration/legacy-app.ts`
 * reads it in the browser, and it goes away with the last legacy route - at
 * which point this list is empty and the argument comes off the call entirely.
 */
const APP_CLIENT_ENV = ['NEXT_PUBLIC_LEGACY_WEB_URL']

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

    expect(
      call,
      'vite.config.ts calls vitNodeEnv({ clientEnv: [...] })',
    ).not.toBeNull()

    const named = [...(call?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    )

    expect(named).toStrictEqual(APP_CLIENT_ENV)
  })

  it('names nothing that is not a public key', () => {
    // `NEXT_PUBLIC_*` is the naming convention `CONFIG` and Next.js both use for
    // "this is readable by anybody who opens devtools". A key without the prefix
    // on this list is either a mistake or a secret.
    for (const key of APP_CLIENT_ENV) {
      expect(key.startsWith('NEXT_PUBLIC_')).toBe(true)
    }
  })

  it('publishes the migration key because something in the browser reads it', () => {
    // The other half of the justification. A published key nothing reads is a
    // key that should not be published, and this one is read by the module that
    // builds an href into the application still serving the un-migrated routes.
    expect(read('src/migration/legacy-app.ts')).toContain(
      'process.env.NEXT_PUBLIC_LEGACY_WEB_URL',
    )
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
